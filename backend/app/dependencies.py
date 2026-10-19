"""Composition root: providers de dependencias para FastAPI (Depends).

KISS: usamos el DI nativo de FastAPI, sin contenedor propio. Los recursos de larga vida (engine +
session factory) se crean UNA vez en el lifespan (main.py) y se leen de app.state. Los repos/servicios
se construyen por request (baratos: solo envuelven la session factory)."""

from __future__ import annotations

import uuid
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, Request, status

from app.adapters.catalog_repo import (
    SqlAlchemyAreaRepository,
    SqlAlchemyCategoryRepository,
)
from app.adapters.email_sender import SmtpEmailSender
from app.adapters.employee_repo import SqlAlchemyEmployeeRepository
from app.adapters.event_bus import RedisNotificationBus
from app.adapters.gateway_client import HttpGatewayClient
from app.adapters.notification_repo import SqlAlchemyNotificationRepository
from app.adapters.sla_repo import SqlAlchemySlaPolicyRepository
from app.adapters.ticket_repo import SqlAlchemyTicketRepository
from app.adapters.user_repo import SqlAlchemyUserRepository
from app.config import Settings, get_settings
from app.domain.models import Caller, Principal, Priority, Role, User, UserContext
from app.domain.ports import NotificationChannel, ObjectStorage
from app.services.sla_service import SlaService
from app.services.auth import verify_service_token
from app.services.catalog_service import CatalogService
from app.services.certificate import CertificateRenderer
from app.services.certificate_service import CertificateService
from app.services.employee_service import EmployeeService
from app.services.notifications import EmailChannel, NotificationService, WhatsAppChannel
from app.services.ticket_service import TicketService
from app.services.tokens import decode_access_token
from app.services.user_events import UserEventNotifier
from app.services.user_service import UserService

SettingsDep = Annotated[Settings, Depends(get_settings)]


# --- Repos (construidos sobre la session factory compartida) ---

def get_area_repo(request: Request) -> SqlAlchemyAreaRepository:
    return SqlAlchemyAreaRepository(request.app.state.session_factory)


def get_category_repo(request: Request) -> SqlAlchemyCategoryRepository:
    return SqlAlchemyCategoryRepository(request.app.state.session_factory)


def get_ticket_repo(request: Request) -> SqlAlchemyTicketRepository:
    return SqlAlchemyTicketRepository(request.app.state.session_factory)


def get_sla_service(request: Request) -> SlaService:
    return SlaService(SqlAlchemySlaPolicyRepository(request.app.state.session_factory))


def get_user_repo(request: Request) -> SqlAlchemyUserRepository:
    return SqlAlchemyUserRepository(request.app.state.session_factory)


AreaRepoDep = Annotated[SqlAlchemyAreaRepository, Depends(get_area_repo)]
CategoryRepoDep = Annotated[SqlAlchemyCategoryRepository, Depends(get_category_repo)]
TicketRepoDep = Annotated[SqlAlchemyTicketRepository, Depends(get_ticket_repo)]
UserRepoDep = Annotated[SqlAlchemyUserRepository, Depends(get_user_repo)]


# --- Servicios ---

def get_catalog_service(areas: AreaRepoDep, categories: CategoryRepoDep) -> CatalogService:
    return CatalogService(areas, categories)


SlaServiceDep = Annotated[SlaService, Depends(get_sla_service)]


def get_ticket_service(
    tickets: TicketRepoDep,
    categories: CategoryRepoDep,
    sla: SlaServiceDep,
    settings: SettingsDep,
) -> TicketService:
    return TicketService(
        tickets,
        categories,
        sla,
        settings.RADICADO_PREFIX,
        settings.LOG_TZ_OFFSET_HOURS,
        Priority(settings.DEFAULT_PRIORITY),
    )


def get_user_service(users: UserRepoDep, areas: AreaRepoDep) -> UserService:
    return UserService(users, areas)


def get_notification_repo(request: Request) -> SqlAlchemyNotificationRepository:
    return SqlAlchemyNotificationRepository(request.app.state.session_factory)


def get_notification_bus(request: Request) -> RedisNotificationBus:
    return RedisNotificationBus(request.app.state.redis)


NotificationRepoDep = Annotated[SqlAlchemyNotificationRepository, Depends(get_notification_repo)]
NotificationBusDep = Annotated[RedisNotificationBus, Depends(get_notification_bus)]


def get_external_channels(
    request: Request, settings: SettingsDep
) -> list[NotificationChannel]:
    """Canales externos activos según config. Si nada está configurado → [] (solo in-app)."""
    channels: list[NotificationChannel] = []
    if settings.whatsapp_configured:
        gateway = HttpGatewayClient(
            request.app.state.http_client,
            settings.GATEWAY_BASE_URL,
            settings.GATEWAY_INTERNAL_KEY,
            settings.WHATSAPP_PHONE_NUMBER_ID,
        )
        channels.append(
            WhatsAppChannel(
                gateway, settings.WHATSAPP_TEMPLATE_NAME, settings.WHATSAPP_TEMPLATE_LANG
            )
        )
    if settings.email_configured:
        sender = SmtpEmailSender(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            sender=settings.SMTP_FROM,
            use_tls=settings.SMTP_USE_TLS,
        )
        channels.append(EmailChannel(sender))
    return channels


ExternalChannelsDep = Annotated[list[NotificationChannel], Depends(get_external_channels)]


def get_notifier(
    users: UserRepoDep,
    notifications: NotificationRepoDep,
    bus: NotificationBusDep,
    channels: ExternalChannelsDep,
) -> NotificationService:
    return NotificationService(users, notifications, bus, channels)


def get_employee_service(request: Request) -> EmployeeService:
    return EmployeeService(SqlAlchemyEmployeeRepository(request.app.state.session_factory))


CatalogServiceDep = Annotated[CatalogService, Depends(get_catalog_service)]
TicketServiceDep = Annotated[TicketService, Depends(get_ticket_service)]
UserServiceDep = Annotated[UserService, Depends(get_user_service)]
NotifierDep = Annotated[NotificationService, Depends(get_notifier)]
EmployeeServiceDep = Annotated[EmployeeService, Depends(get_employee_service)]


# --- Almacenamiento de objetos (R2) + certificados ---

def get_object_storage(request: Request) -> ObjectStorage | None:
    # None si R2 no está configurado (el endpoint de certificado responde 503).
    return request.app.state.object_storage


async def require_object_storage(
    storage: Annotated["ObjectStorage | None", Depends(get_object_storage)],
) -> ObjectStorage:
    if storage is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Almacenamiento de documentos (R2) no configurado.",
        )
    return storage


def get_certificate_service(
    employees: EmployeeServiceDep,
    tickets: TicketServiceDep,
    storage: Annotated[ObjectStorage, Depends(require_object_storage)],
    settings: SettingsDep,
) -> CertificateService:
    renderer = CertificateRenderer(
        org_header=settings.CERT_ORG_HEADER,
        signatory_name=settings.CERT_SIGNATORY_NAME,
        signatory_title=settings.CERT_SIGNATORY_TITLE,
        footer_whatsapp=settings.CERT_FOOTER_WHATSAPP,
        city=settings.CERT_CITY,
        logo_path=settings.CERT_LOGO_PATH,
    )
    return CertificateService(
        employees,
        renderer,
        storage,
        tickets,
        category_code=settings.CERTIFICATE_CATEGORY_CODE,
        tz_offset_hours=settings.LOG_TZ_OFFSET_HOURS,
        signed_url_ttl=settings.R2_SIGNED_URL_TTL_SECONDS,
    )


CertificateServiceDep = Annotated[CertificateService, Depends(get_certificate_service)]


def get_user_event_notifier(request: Request, settings: SettingsDep) -> UserEventNotifier:
    """Notificador del evento de vuelta al usuario. Sin config → gateway None (se omite limpio)."""
    gateway = None
    if settings.user_event_configured:
        gateway = HttpGatewayClient(
            request.app.state.http_client,
            settings.GATEWAY_BASE_URL,
            settings.GATEWAY_INTERNAL_KEY,
            settings.WHATSAPP_PHONE_NUMBER_ID,
        )
    return UserEventNotifier(
        gateway,
        settings.USER_EVENT_TEMPLATE_NAME,
        settings.USER_EVENT_TEMPLATE_LANG,
        settings.notify_user_statuses,
    )


UserEventNotifierDep = Annotated[UserEventNotifier, Depends(get_user_event_notifier)]


# --- Seguridad: service-token (Bearer) ---

async def require_service_token(
    settings: SettingsDep,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> Principal:
    """Valida el Bearer contra TICKETING_SERVICE_TOKEN. 401 si falta/!=. RBAC humano = incremento 2."""
    token: str | None = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer ") :].strip()
    principal = verify_service_token(token, settings.TICKETING_SERVICE_TOKEN)
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de servicio inválido o ausente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return principal


PrincipalDep = Annotated[Principal, Depends(require_service_token)]


# --- Seguridad: usuario humano (JWT de sesión) + RBAC ---

_INVALID_TOKEN = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Token inválido o expirado.",
    headers={"WWW-Authenticate": "Bearer"},
)


def _user_context(user: User) -> UserContext:
    return UserContext(
        user_id=user.id,
        email=user.email,
        role=user.role,
        display_name=user.display_name,
        area_codes=tuple(user.area_codes),
    )


def _bearer(authorization: str | None) -> str | None:
    if authorization and authorization.startswith("Bearer "):
        return authorization[len("Bearer ") :].strip()
    return None


async def _user_from_jwt(token: str, settings: Settings, users: UserRepoDep) -> UserContext:
    try:
        claims = decode_access_token(token, settings.AUTH_JWT_SIGNING_KEY)
        user_id = uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise _INVALID_TOKEN from exc
    user = await users.get(user_id)
    if user is None or not user.active:
        raise _INVALID_TOKEN
    return _user_context(user)


async def require_user(
    settings: SettingsDep,
    users: UserRepoDep,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> UserContext:
    """Valida el Bearer JWT y resuelve el usuario desde la BD (rol/estado/áreas frescos).

    Cargar de BD (no del claim) hace que desactivar o recategorizar a un usuario surta efecto
    inmediato; el coste es una query indexada por request."""
    token = _bearer(authorization)
    if token is None:
        raise _INVALID_TOKEN
    return await _user_from_jwt(token, settings, users)


UserContextDep = Annotated[UserContext, Depends(require_user)]


async def require_admin(user: UserContextDep) -> UserContext:
    """Exige rol admin. 403 si el usuario autenticado no es admin."""
    if user.role != Role.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Requiere rol admin."
        )
    return user


AdminDep = Annotated[UserContext, Depends(require_admin)]


async def require_caller(
    settings: SettingsDep,
    users: UserRepoDep,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> Caller:
    """Acepta el service-token del bot (acceso total) O el JWT de un usuario humano (RBAC).

    Ambos viajan como `Authorization: Bearer`: primero se prueba el service-token (comparación
    constante); si no coincide, se interpreta como JWT de usuario."""
    token = _bearer(authorization)
    if token is None:
        raise _INVALID_TOKEN
    if verify_service_token(token, settings.TICKETING_SERVICE_TOKEN) is not None:
        return Caller(kind="service")
    return Caller(kind="user", user=await _user_from_jwt(token, settings, users))


CallerDep = Annotated[Caller, Depends(require_caller)]


async def require_privileged(caller: CallerDep) -> Caller:
    """Exige acceso total: el service-token o un admin. 403 para un agente."""
    if not caller.sees_all_areas:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Requiere rol admin."
        )
    return caller


PrivilegedDep = Annotated[Caller, Depends(require_privileged)]

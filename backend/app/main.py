"""Punto de entrada de la app FastAPI (servicio Ticketing).

El lifespan crea los recursos compartidos de larga vida (engine async + session factory) una sola vez.
Fail-fast: si falta DATABASE_URL o TICKETING_SERVICE_TOKEN, el arranque falla (no queremos correr sin
BD ni con la API abierta).

En SQLite (tests/dev) se crea el esquema al vuelo (create_all). En Postgres el esquema lo gestiona
Alembic (`alembic upgrade head` en el arranque del contenedor); aquí NO usamos create_all."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as redis
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.adapters.db_models import Base
from app.api import (
    auth,
    catalog,
    certificates,
    employees,
    health,
    notifications,
    sla,
    tickets,
    users,
)
from app.config import get_settings
from app.domain.errors import DomainError
from app.logging_config import configure_logging

logger = logging.getLogger(__name__)


async def _seed_admin(session_factory, settings) -> None:
    """Crea el primer usuario admin si no existe (idempotente). Reemplaza el bootstrap por endpoint."""
    if not (settings.SEED_ADMIN_EMAIL and settings.SEED_ADMIN_PASSWORD):
        logger.warning("SEED_ADMIN_EMAIL/PASSWORD sin configurar; no se sembró admin inicial.")
        return
    from app.adapters.catalog_repo import SqlAlchemyAreaRepository
    from app.adapters.user_repo import SqlAlchemyUserRepository
    from app.domain.errors import ConflictError, DomainError
    from app.domain.models import Role
    from app.services.user_service import UserService

    service = UserService(
        SqlAlchemyUserRepository(session_factory), SqlAlchemyAreaRepository(session_factory)
    )
    try:
        await service.create_user(
            email=settings.SEED_ADMIN_EMAIL,
            password=settings.SEED_ADMIN_PASSWORD,
            role=Role.admin,
        )
        logger.info("Admin inicial sembrado: %s", settings.SEED_ADMIN_EMAIL)
    except ConflictError:
        logger.info("Admin inicial ya existe; no se re-siembra.")
    except DomainError as exc:
        logger.error("No se pudo sembrar el admin inicial: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL, settings.LOG_FORMAT, settings.LOG_TZ_OFFSET_HOURS)

    # Fail-fast de configuración crítica.
    if not settings.DATABASE_URL:
        raise RuntimeError("DATABASE_URL es obligatoria.")
    if not settings.TICKETING_SERVICE_TOKEN:
        raise RuntimeError(
            "TICKETING_SERVICE_TOKEN es obligatorio (autentica al Gateway). Genera uno con "
            'python -c "import secrets; print(secrets.token_urlsafe(48))".'
        )
    if len(settings.AUTH_JWT_SIGNING_KEY) < 32:
        raise RuntimeError(
            "AUTH_JWT_SIGNING_KEY es obligatoria y debe tener >=32 bytes (HS256, firma de los JWT de "
            'sesión). Genera: python -c "import secrets; print(secrets.token_urlsafe(48))".'
        )

    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    app.state.engine = engine
    app.state.session_factory = async_sessionmaker(engine, expire_on_commit=False)
    if engine.dialect.name == "sqlite":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Bootstrap: sembrar el primer admin (idempotente). En Postgres el esquema ya lo aplicó Alembic.
    await _seed_admin(app.state.session_factory, settings)

    # Recursos compartidos: Redis (bus SSE) y UN httpx.AsyncClient (llamadas al Gateway).
    app.state.redis = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    app.state.http_client = httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0))

    # Almacenamiento de documentos (R2). None si no está configurado: el endpoint de certificado
    # responde 503. Import perezoso del adaptador para no exigir aioboto3 cuando R2 está apagado.
    app.state.object_storage = None
    if settings.r2_configured:
        from app.adapters.r2_storage import R2ObjectStorage

        app.state.object_storage = R2ObjectStorage(
            endpoint_url=settings.R2_ENDPOINT_URL,
            bucket=settings.R2_BUCKET,
            access_key_id=settings.R2_ACCESS_KEY_ID,
            secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region=settings.R2_REGION,
        )
        logger.info("Almacenamiento R2 activo (bucket=%s)", settings.R2_BUCKET)

    logger.info("Ticketing arrancado", extra={"api_prefix": settings.API_PREFIX})
    try:
        yield
    finally:
        await app.state.http_client.aclose()
        await app.state.redis.aclose()
        await engine.dispose()
        logger.info("Ticketing detenido; recursos liberados")


app = FastAPI(
    title="Ticketing API",
    version="0.1.0",
    description=(
        "Backend del producto Ticketing (mesa de ayuda / gestión de requerimientos). Expone la API "
        "de dominio que el WhatsApp Gateway + IA consume para crear/consultar tickets. Ver /docs."
    ),
    lifespan=lifespan,
)


@app.exception_handler(DomainError)
async def _domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
    """Traduce errores de dominio a HTTP con {"detail": ...} (calca el schema Error del contrato)."""
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


_settings = get_settings()
_prefix = _settings.API_PREFIX

# CORS para el FRONT (navegador). Solo se monta si hay orígenes configurados; el bot/Gateway no lo usa.
if _settings.cors_origins_list:
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_settings.cors_origins_list,  # no usar "*" junto con allow_credentials
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(health.router)
app.include_router(tickets.router, prefix=_prefix)
app.include_router(catalog.areas_router, prefix=_prefix)
app.include_router(catalog.categories_router, prefix=_prefix)
app.include_router(auth.router, prefix=_prefix)
app.include_router(users.router, prefix=_prefix)
app.include_router(notifications.router, prefix=_prefix)
# (El bootstrap de usuarios ya no es un endpoint: el primer admin se siembra en el lifespan.)
app.include_router(employees.router, prefix=_prefix)
app.include_router(certificates.router, prefix=_prefix)
app.include_router(sla.router, prefix=_prefix)

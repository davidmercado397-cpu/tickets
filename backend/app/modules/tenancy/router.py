from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Response, UploadFile, status

from app.core.context import Ctx
from app.core.errors import NotFoundError, ValidationError
from app.core.storage import new_key, storage
from app.modules.identity import public as identity
from app.modules.identity.public import SessionDep, SuperadminDep, TenantCtxDep, require
from app.modules.tenancy import service
from app.modules.tenancy.schemas import (
    EmailInboundUpdate,
    IntegrationKeyCreate,
    IntegrationKeyCreated,
    IntegrationKeyOut,
    PlatformTenantUpdate,
    PlatformUserCreate,
    PlatformUserOut,
    PlatformUserUpdate,
    PortalSettings,
    PublicTenantOut,
    TenantCreate,
    TenantOut,
    TenantUpdate,
)

platform_router = APIRouter(prefix="/platform", tags=["plataforma"])
router = APIRouter(prefix="/tenant", tags=["empresa"])
public_router = APIRouter(prefix="/public/tenants", tags=["portal público"])

SettingsCtx = Annotated[Ctx, Depends(require("tenant.settings"))]
IntegrationsCtx = Annotated[Ctx, Depends(require("integrations.manage"))]

_LOGO_TYPES = {"image/png", "image/jpeg", "image/svg+xml", "image/webp"}


# --- Superadmin ---

@platform_router.get("/tenants", response_model=list[TenantOut])
async def list_tenants(_: SuperadminDep, session: SessionDep) -> list[TenantOut]:
    return [service.tenant_out(t) for t in await service.list_tenants(session)]


@platform_router.post("/tenants", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(body: TenantCreate, _: SuperadminDep, session: SessionDep) -> TenantOut:
    return service.tenant_out(await service.create_tenant(session, body.model_dump()))


@platform_router.patch("/tenants/{tenant_id}", response_model=TenantOut)
async def update_platform_tenant(
    tenant_id: uuid.UUID, body: PlatformTenantUpdate, _: SuperadminDep, session: SessionDep
) -> TenantOut:
    tenant = await service.get_tenant(session, tenant_id)
    return service.tenant_out(await service.update_tenant(session, tenant, body.model_dump(exclude_unset=True)))


def _platform_user(u) -> PlatformUserOut:
    return PlatformUserOut(
        id=u.id, email=u.email, full_name=u.full_name, active=u.active, is_admin=identity.is_tenant_admin(u),
        roles=[r.name for r in u.roles], last_login_at=u.last_login_at,
    )


@platform_router.get("/tenants/{tenant_id}/users", response_model=list[PlatformUserOut])
async def list_tenant_users(tenant_id: uuid.UUID, _: SuperadminDep, session: SessionDep) -> list[PlatformUserOut]:
    await service.get_tenant(session, tenant_id)
    users = await identity.list_tenant_users(session, tenant_id)
    # Administradores primero.
    return sorted((_platform_user(u) for u in users), key=lambda u: (not u.is_admin, u.full_name.lower()))


@platform_router.post("/tenants/{tenant_id}/users", response_model=PlatformUserOut, status_code=status.HTTP_201_CREATED)
async def create_tenant_admin(
    tenant_id: uuid.UUID, body: PlatformUserCreate, _: SuperadminDep, session: SessionDep
) -> PlatformUserOut:
    """Agrega un administrador a la empresa (rol Administrador)."""
    await service.get_tenant(session, tenant_id)
    user = await identity.create_user(session, tenant_id, body.model_dump(), role_codes=["admin"])
    return _platform_user(user)


@platform_router.patch("/tenants/{tenant_id}/users/{user_id}", response_model=PlatformUserOut)
async def update_tenant_user(
    tenant_id: uuid.UUID, user_id: uuid.UUID, body: PlatformUserUpdate, _: SuperadminDep, session: SessionDep
) -> PlatformUserOut:
    user = await identity.platform_update_user(session, tenant_id, user_id, body.model_dump(exclude_unset=True))
    return _platform_user(user)


# --- Empresa propia ---

@router.get("", response_model=TenantOut)
async def get_my_tenant(ctx: TenantCtxDep, session: SessionDep) -> TenantOut:
    return service.tenant_out(await service.get_tenant(session, ctx.tid))


@router.patch("", response_model=TenantOut)
async def update_my_tenant(body: TenantUpdate, ctx: SettingsCtx, session: SessionDep) -> TenantOut:
    tenant = await service.get_tenant(session, ctx.tid)
    data = body.model_dump(exclude_unset=True)
    for section in ("portal", "letter", "notifications", "quality"):
        if getattr(body, section) is not None:
            data[section] = getattr(body, section).model_dump(mode="json")
    return service.tenant_out(await service.update_tenant(session, tenant, data))


@router.put("/email-inbound", response_model=TenantOut)
async def update_email_inbound(body: EmailInboundUpdate, ctx: SettingsCtx, session: SessionDep) -> TenantOut:
    tenant = await service.get_tenant(session, ctx.tid)
    return service.tenant_out(await service.update_email_inbound(session, tenant, body.model_dump()))


@router.post("/logo", status_code=status.HTTP_204_NO_CONTENT)
async def upload_logo(ctx: SettingsCtx, session: SessionDep, file: UploadFile = File(...)) -> None:
    if file.content_type not in _LOGO_TYPES:
        raise ValidationError("El logo debe ser PNG, JPG, WEBP o SVG.")
    data = await file.read()
    if len(data) > 2_000_000:
        raise ValidationError("El logo no puede superar 2 MB.")
    tenant = await service.get_tenant(session, ctx.tid)
    key = new_key(tenant.id, "branding", file.filename or "logo")
    await storage().put(key, data, file.content_type)
    tenant.logo_key, tenant.logo_mime = key, file.content_type
    await session.commit()


@router.get("/integration-keys", response_model=list[IntegrationKeyOut])
async def list_keys(ctx: IntegrationsCtx, session: SessionDep) -> list[IntegrationKeyOut]:
    return [IntegrationKeyOut.model_validate(k) for k in await service.list_keys(session, ctx)]


@router.post("/integration-keys", response_model=IntegrationKeyCreated, status_code=status.HTTP_201_CREATED)
async def create_key(body: IntegrationKeyCreate, ctx: IntegrationsCtx, session: SessionDep) -> IntegrationKeyCreated:
    key, raw = await service.create_key(session, ctx, body.name)
    return IntegrationKeyCreated(**IntegrationKeyOut.model_validate(key).model_dump(), key=raw)


@router.delete("/integration-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_key(key_id: uuid.UUID, ctx: IntegrationsCtx, session: SessionDep) -> None:
    await service.revoke_key(session, ctx, key_id)


# --- Público (portal) ---

@public_router.get("/{slug}", response_model=PublicTenantOut)
async def public_tenant(slug: str, session: SessionDep) -> PublicTenantOut:
    t = await service.get_by_slug(session, slug)
    return PublicTenantOut(
        slug=t.slug,
        name=t.name,
        legal_name=t.legal_name,
        nit=t.nit,
        phone=t.phone,
        email=t.email,
        website=t.website,
        address=t.address,
        city=t.city,
        primary_color=t.primary_color,
        secondary_color=t.secondary_color,
        has_logo=bool(t.logo_key),
        portal=PortalSettings(**(t.settings or {}).get("portal", {})),
    )


@public_router.get("/{slug}/logo")
async def public_logo(slug: str, session: SessionDep) -> Response:
    t = await service.get_by_slug(session, slug)
    if not t.logo_key:
        raise NotFoundError("La empresa no tiene logo.")
    return Response(
        await storage().get(t.logo_key),
        media_type=t.logo_mime or "image/png",
        headers={"Cache-Control": "public, max-age=300"},
    )

"""Empresas (tenants): alta por el superadmin, configuración, marca y API keys."""

from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.context import Ctx
from app.core.db import utcnow
from app.core.errors import ConflictError, NotFoundError, UnauthorizedError
from app.core.module import run_tenant_seeders
from app.core.security import encrypt_secret, hash_api_key, new_api_key
from app.core.text import slugify
from app.modules.tenancy.models import Counter, IntegrationKey, Tenant
from app.modules.tenancy.schemas import (
    EmailInboundSettings,
    LetterSettings,
    NotificationSettings,
    PortalSettings,
    QualitySettings,
    TenantOut,
)

SETTINGS_SECTIONS = {
    "portal": PortalSettings,
    "letter": LetterSettings,
    "notifications": NotificationSettings,
    "quality": QualitySettings,
}


def tenant_out(t: Tenant) -> TenantOut:
    out = TenantOut.model_validate(t)
    s = t.settings or {}
    out.has_logo = bool(t.logo_key)
    out.portal = PortalSettings(**s.get("portal", {}))
    out.letter = LetterSettings(**s.get("letter", {}))
    out.notifications = NotificationSettings(**s.get("notifications", {}))
    out.quality = QualitySettings(**s.get("quality", {}))
    inbound = dict(s.get("email_inbound", {}))
    inbound["has_password"] = bool(inbound.pop("password_enc", None))
    out.email_inbound = EmailInboundSettings(**inbound)
    return out


async def get_tenant(session: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise NotFoundError("Empresa no encontrada.")
    return tenant


async def get_by_slug(session: AsyncSession, slug: str) -> Tenant:
    tenant = (await session.execute(select(Tenant).where(Tenant.slug == slug))).scalar_one_or_none()
    if tenant is None or not tenant.active:
        raise NotFoundError("Empresa no encontrada.")
    return tenant


async def create_tenant(session: AsyncSession, data: dict) -> Tenant:
    from app.modules.identity.public import create_user

    slug = data.get("slug") or slugify(data["name"], 60, "-")
    if (await session.execute(select(Tenant.id).where(Tenant.slug == slug))).first():
        raise ConflictError(f"Ya existe una empresa con el identificador '{slug}'.")
    tenant = Tenant(
        slug=slug,
        name=data["name"],
        legal_name=data.get("legal_name") or data["name"],
        nit=data.get("nit"),
        radicado_prefix=data.get("radicado_prefix", "PQRS"),
        city=data.get("city"),
        settings={"letter": {"city": data.get("city") or ""}},
    )
    session.add(tenant)
    await session.flush()
    # Cada módulo siembra lo suyo (roles, tipos PQRS, SLA, calendario, formularios de ejemplo...).
    await run_tenant_seeders(session, tenant.id)
    await create_user(
        session,
        tenant.id,
        {
            "email": data["admin_email"],
            "full_name": data["admin_full_name"],
            "password": data["admin_password"],
        },
        role_codes=["admin"],
        commit=False,
    )
    await session.commit()
    return tenant


async def list_tenants(session: AsyncSession) -> list[Tenant]:
    return list((await session.execute(select(Tenant).order_by(Tenant.name))).scalars())


async def update_tenant(session: AsyncSession, tenant: Tenant, data: dict) -> Tenant:
    settings = dict(tenant.settings or {})
    for section in SETTINGS_SECTIONS:
        value = data.pop(section, None)
        if value is not None:
            settings[section] = {**settings.get(section, {}), **value}
    for key, value in data.items():
        if value is not None:
            setattr(tenant, key, value)
    tenant.settings = settings
    await session.commit()
    return tenant


async def update_email_inbound(session: AsyncSession, tenant: Tenant, data: dict) -> Tenant:
    settings = dict(tenant.settings or {})
    current = dict(settings.get("email_inbound", {}))
    password = data.pop("password", None)
    current.update(data)
    if password:
        current["password_enc"] = encrypt_secret(password, get_settings().SECRETS_ENCRYPTION_KEY)
    settings["email_inbound"] = current
    tenant.settings = settings
    await session.commit()
    return tenant


async def next_sequence(session: AsyncSession, tenant_id: uuid.UUID, name: str) -> int:
    """Incremento atómico (INSERT ... ON CONFLICT DO UPDATE ... RETURNING) en PG y SQLite."""
    dialect = session.bind.dialect.name if session.bind else "postgresql"
    if dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert
    else:
        from sqlalchemy.dialects.postgresql import insert
    stmt = (
        insert(Counter)
        .values(tenant_id=tenant_id, name=name, value=1)
        .on_conflict_do_update(index_elements=["tenant_id", "name"], set_={"value": Counter.value + 1})
        .returning(Counter.value)
    )
    return (await session.execute(stmt)).scalar_one()


# --- API keys de integración ---

async def list_keys(session: AsyncSession, ctx: Ctx) -> list[IntegrationKey]:
    stmt = select(IntegrationKey).where(IntegrationKey.tenant_id == ctx.tid).order_by(IntegrationKey.created_at)
    return list((await session.execute(stmt)).scalars())


async def create_key(session: AsyncSession, ctx: Ctx, name: str) -> tuple[IntegrationKey, str]:
    raw, prefix, digest = new_api_key()
    key = IntegrationKey(tenant_id=ctx.tid, name=name, prefix=prefix, key_hash=digest)
    session.add(key)
    await session.commit()
    return key, raw


async def revoke_key(session: AsyncSession, ctx: Ctx, key_id: uuid.UUID) -> None:
    key = await session.get(IntegrationKey, key_id)
    if key is None or key.tenant_id != ctx.tid:
        raise NotFoundError("API key no encontrada.")
    key.active = False
    await session.commit()


INTEGRATION_PERMISSIONS = frozenset(
    {"pqrs.create", "pqrs.view_all", "clients.view", "employees.view", "visits.view_all", "tasks.manage"}
)


async def ctx_from_api_key(session: AsyncSession, raw: str) -> Ctx:
    key = (
        await session.execute(select(IntegrationKey).where(IntegrationKey.key_hash == hash_api_key(raw)))
    ).scalar_one_or_none()
    if key is None or not key.active:
        raise UnauthorizedError("API key inválida.")
    tenant = await session.get(Tenant, key.tenant_id)
    if tenant is None or not tenant.active:
        raise UnauthorizedError("Empresa inactiva.")
    await session.execute(
        update(IntegrationKey).where(IntegrationKey.id == key.id).values(last_used_at=utcnow())
    )
    await session.commit()
    return Ctx(tenant_id=key.tenant_id, integration=key.name, permissions=INTEGRATION_PERMISSIONS)

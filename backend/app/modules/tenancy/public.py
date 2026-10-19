"""Fachada pública del módulo tenancy."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import Ctx
from app.core.db import get_session
from app.core.errors import UnauthorizedError
from app.modules.tenancy import service
from app.modules.tenancy.models import Tenant
from app.modules.tenancy.service import next_sequence  # noqa: F401 - re-exportado


async def get_tenant_brief(session: AsyncSession, tenant_id: uuid.UUID) -> dict:
    t = await service.get_tenant(session, tenant_id)
    return {
        "id": t.id,
        "slug": t.slug,
        "name": t.name,
        "primary_color": t.primary_color,
        "secondary_color": t.secondary_color,
        "has_logo": bool(t.logo_key),
    }


async def get_tenant_info(session: AsyncSession, tenant_id: uuid.UUID) -> dict:
    """Datos completos para documentos (carta de respuesta) y correos."""
    t = await service.get_tenant(session, tenant_id)
    return {
        "id": t.id,
        "slug": t.slug,
        "name": t.name,
        "legal_name": t.legal_name or t.name,
        "nit": t.nit,
        "address": t.address,
        "city": t.city,
        "phone": t.phone,
        "email": t.email,
        "website": t.website,
        "primary_color": t.primary_color,
        "secondary_color": t.secondary_color,
        "logo_key": t.logo_key,
        "radicado_prefix": t.radicado_prefix,
        "settings": t.settings or {},
    }


async def tenant_id_by_slug(session: AsyncSession, slug: str) -> uuid.UUID:
    return (await service.get_by_slug(session, slug)).id


async def active_tenants(session: AsyncSession) -> list[Tenant]:
    return [t for t in await service.list_tenants(session) if t.active]


async def integration_ctx(
    session: Annotated[AsyncSession, Depends(get_session)],
    x_api_key: Annotated[str | None, Header()] = None,
) -> Ctx:
    """Autenticación de integraciones (bot WhatsApp, minutas...) por `X-Api-Key`."""
    if not x_api_key:
        raise UnauthorizedError("Falta la cabecera X-Api-Key.")
    return await service.ctx_from_api_key(session, x_api_key)


IntegrationCtxDep = Annotated[Ctx, Depends(integration_ctx)]

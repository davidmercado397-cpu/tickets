"""Fachada pública de clientes/sedes."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationError
from app.modules.clients.models import Client, Site
from app.modules.clients.service import find_by_nit, normalize_nit  # noqa: F401


async def validate_client_site(
    session: AsyncSession, tenant_id: uuid.UUID, client_id: uuid.UUID | None, site_id: uuid.UUID | None
) -> tuple[uuid.UUID | None, uuid.UUID | None]:
    """Valida cliente/sede. Si solo llega la sede, deduce el cliente."""
    if site_id is not None:
        site = await session.get(Site, site_id)
        if site is None or site.tenant_id != tenant_id:
            raise ValidationError("Sede inválida.")
        if client_id is not None and site.client_id != client_id:
            raise ValidationError("La sede no pertenece al cliente.")
        return site.client_id, site.id
    if client_id is not None:
        client = await session.get(Client, client_id)
        if client is None or client.tenant_id != tenant_id:
            raise ValidationError("Cliente inválido.")
    return client_id, None


async def names(session: AsyncSession, tenant_id: uuid.UUID) -> dict[str, dict[uuid.UUID, str]]:
    clients = await session.execute(select(Client.id, Client.name).where(Client.tenant_id == tenant_id))
    sites = await session.execute(select(Site.id, Site.name).where(Site.tenant_id == tenant_id))
    return {"clients": {r.id: r.name for r in clients}, "sites": {r.id: r.name for r in sites}}


async def client_contact(session: AsyncSession, tenant_id: uuid.UUID, client_id: uuid.UUID | None) -> dict | None:
    if client_id is None:
        return None
    c = await session.get(Client, client_id)
    if c is None or c.tenant_id != tenant_id:
        return None
    return {"name": c.name, "nit": c.nit, "contact_name": c.contact_name, "email": c.contact_email,
            "phone": c.contact_phone, "address": c.address, "city": c.city}


async def active_sites(session: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    rows = await session.execute(
        select(Site.id, Site.name, Site.client_id).where(Site.tenant_id == tenant_id, Site.active.is_(True))
    )
    return [{"id": r.id, "name": r.name, "client_id": r.client_id} for r in rows]


async def active_clients(session: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    rows = await session.execute(
        select(Client.id, Client.name).where(Client.tenant_id == tenant_id, Client.active.is_(True))
    )
    return [{"id": r.id, "name": r.name} for r in rows]

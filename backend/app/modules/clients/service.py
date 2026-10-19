from __future__ import annotations

import re
import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.context import Ctx
from app.core.errors import ConflictError, NotFoundError
from app.core.text import slugify
from app.modules.clients.models import Client, Site


def normalize_nit(nit: str) -> str:
    """'900.369.097-1' → '900369097-1' (sin puntos ni espacios)."""
    return re.sub(r"[^0-9Kk-]", "", nit).upper()


async def list_clients(session: AsyncSession, ctx: Ctx, q: str | None = None, active: bool | None = None) -> list[Client]:
    stmt = select(Client).where(Client.tenant_id == ctx.tid).order_by(Client.name)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Client.name.ilike(like), Client.nit.ilike(like)))
    if active is not None:
        stmt = stmt.where(Client.active.is_(active))
    return list((await session.execute(stmt)).scalars())


async def get_client(session: AsyncSession, tenant_id: uuid.UUID, client_id: uuid.UUID) -> Client:
    stmt = (select(Client).where(Client.id == client_id).options(selectinload(Client.sites))
            .execution_options(populate_existing=True))
    client = (await session.execute(stmt)).scalar_one_or_none()
    if client is None or client.tenant_id != tenant_id:
        raise NotFoundError("Cliente no encontrado.")
    return client


async def create_client(session: AsyncSession, ctx: Ctx, data: dict) -> Client:
    data["nit"] = normalize_nit(data["nit"])
    if (await session.execute(select(Client.id).where(Client.tenant_id == ctx.tid, Client.nit == data["nit"]))).first():
        raise ConflictError("Ya existe un cliente con ese NIT.")
    client = Client(tenant_id=ctx.tid, **data)
    session.add(client)
    await session.commit()
    return await get_client(session, ctx.tid, client.id)


async def update_client(session: AsyncSession, ctx: Ctx, client_id: uuid.UUID, data: dict) -> Client:
    client = await get_client(session, ctx.tid, client_id)
    for key, value in data.items():
        setattr(client, key, value)
    await session.commit()
    return await get_client(session, ctx.tid, client_id)


async def _unique_site_code(session: AsyncSession, tenant_id: uuid.UUID, base: str) -> str:
    code, n = base, 1
    while (await session.execute(select(Site.id).where(Site.tenant_id == tenant_id, Site.code == code))).first():
        n += 1
        code = f"{base[:36]}-{n}"
    return code


async def create_site(session: AsyncSession, ctx: Ctx, client_id: uuid.UUID, data: dict) -> Site:
    client = await get_client(session, ctx.tid, client_id)
    if data.get("code"):
        if (await session.execute(select(Site.id).where(Site.tenant_id == ctx.tid, Site.code == data["code"]))).first():
            raise ConflictError("Ya existe una sede con ese código.")
        code = data["code"]
    else:
        code = await _unique_site_code(session, ctx.tid, slugify(data["name"], 36, "-"))
    site = Site(tenant_id=ctx.tid, client_id=client.id, **{**data, "code": code})
    session.add(site)
    await session.commit()
    return site


async def get_site(session: AsyncSession, tenant_id: uuid.UUID, site_id: uuid.UUID) -> Site:
    site = await session.get(Site, site_id)
    if site is None or site.tenant_id != tenant_id:
        raise NotFoundError("Sede no encontrada.")
    return site


async def update_site(session: AsyncSession, ctx: Ctx, site_id: uuid.UUID, data: dict) -> Site:
    site = await get_site(session, ctx.tid, site_id)
    for key, value in data.items():
        setattr(site, key, value)
    await session.commit()
    return site


async def list_sites(
    session: AsyncSession, ctx: Ctx, client_id: uuid.UUID | None = None, q: str | None = None
) -> list[Site]:
    stmt = select(Site).where(Site.tenant_id == ctx.tid).order_by(Site.name)
    if client_id:
        stmt = stmt.where(Site.client_id == client_id)
    if q:
        stmt = stmt.where(Site.name.ilike(f"%{q}%"))
    return list((await session.execute(stmt)).scalars())


async def find_by_nit(session: AsyncSession, tenant_id: uuid.UUID, nit: str) -> Client | None:
    stmt = select(Client).where(Client.tenant_id == tenant_id, Client.nit == normalize_nit(nit), Client.active.is_(True))
    return (await session.execute(stmt)).scalar_one_or_none()

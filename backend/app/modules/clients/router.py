from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.core.context import Ctx
from app.core.errors import NotFoundError
from app.core.ratelimit import enforce_rate_limit
from app.modules.clients import service
from app.modules.clients.schemas import (
    ClientIn,
    ClientOut,
    ClientUpdate,
    PublicClientLookup,
    PublicSite,
    SiteIn,
    SiteOut,
    SiteUpdate,
)
from app.modules.identity.public import SessionDep, require
from app.modules.tenancy.public import tenant_id_by_slug

router = APIRouter(tags=["clientes"])
public_router = APIRouter(prefix="/public/tenants", tags=["portal público"])
ViewClients = Annotated[Ctx, Depends(require("clients.view", "clients.manage"))]
ManageClients = Annotated[Ctx, Depends(require("clients.manage"))]


@router.get("/clients", response_model=list[ClientOut])
async def list_clients(ctx: ViewClients, session: SessionDep, q: str | None = None, active: bool | None = None) -> list[ClientOut]:
    return [ClientOut.model_validate(c) for c in await service.list_clients(session, ctx, q, active)]


@router.post("/clients", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(body: ClientIn, ctx: ManageClients, session: SessionDep) -> ClientOut:
    return ClientOut.model_validate(await service.create_client(session, ctx, body.model_dump()))


@router.get("/clients/{client_id}", response_model=ClientOut)
async def get_client(client_id: uuid.UUID, ctx: ViewClients, session: SessionDep) -> ClientOut:
    return ClientOut.model_validate(await service.get_client(session, ctx.tid, client_id))


@router.patch("/clients/{client_id}", response_model=ClientOut)
async def update_client(client_id: uuid.UUID, body: ClientUpdate, ctx: ManageClients, session: SessionDep) -> ClientOut:
    c = await service.update_client(session, ctx, client_id, body.model_dump(exclude_unset=True))
    return ClientOut.model_validate(c)


@router.post("/clients/{client_id}/sites", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
async def create_site(client_id: uuid.UUID, body: SiteIn, ctx: ManageClients, session: SessionDep) -> SiteOut:
    return SiteOut.model_validate(await service.create_site(session, ctx, client_id, body.model_dump()))


@router.get("/sites", response_model=list[SiteOut])
async def list_sites(
    ctx: ViewClients, session: SessionDep, client_id: uuid.UUID | None = None, q: str | None = None
) -> list[SiteOut]:
    return [SiteOut.model_validate(s) for s in await service.list_sites(session, ctx, client_id, q)]


@router.patch("/sites/{site_id}", response_model=SiteOut)
async def update_site(site_id: uuid.UUID, body: SiteUpdate, ctx: ManageClients, session: SessionDep) -> SiteOut:
    return SiteOut.model_validate(await service.update_site(session, ctx, site_id, body.model_dump(exclude_unset=True)))


@public_router.get("/{slug}/clients/lookup", response_model=PublicClientLookup)
async def lookup_client(slug: str, nit: str, request: Request, session: SessionDep) -> PublicClientLookup:
    """Portal: el cliente corporativo se identifica con su NIT y elige su sede."""
    await enforce_rate_limit(request, "lookup", 60)
    tenant_id = await tenant_id_by_slug(session, slug)
    client = await service.find_by_nit(session, tenant_id, nit)
    if client is None:
        raise NotFoundError("No encontramos un cliente con ese NIT.")
    return PublicClientLookup(
        id=client.id,
        name=client.name,
        sites=[PublicSite(id=s.id, name=s.name) for s in client.sites if s.active],
    )

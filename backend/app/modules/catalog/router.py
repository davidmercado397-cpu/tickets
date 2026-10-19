from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.context import Ctx
from app.modules.catalog import service
from app.modules.catalog.schemas import (
    CategoryIn,
    CategoryOut,
    CategoryUpdate,
    PublicCatalogOut,
    PublicCategory,
    PublicRequestType,
    PublicSubcategory,
    RequestTypeIn,
    RequestTypeOut,
    RequestTypeUpdate,
    Segment,
    SubcategoryIn,
    SubcategoryOut,
    SubcategoryUpdate,
)
from app.modules.identity.public import SessionDep, TenantCtxDep, require
from app.modules.tenancy.public import tenant_id_by_slug

router = APIRouter(prefix="/catalog", tags=["catálogo"])
public_router = APIRouter(prefix="/public/tenants", tags=["portal público"])
ManageCatalog = Annotated[Ctx, Depends(require("catalog.manage"))]


@router.get("/request-types", response_model=list[RequestTypeOut])
async def list_types(ctx: TenantCtxDep, session: SessionDep) -> list[RequestTypeOut]:
    return [RequestTypeOut.model_validate(t) for t in await service.list_types(session, ctx.tid)]


@router.post("/request-types", response_model=RequestTypeOut, status_code=status.HTTP_201_CREATED)
async def create_type(body: RequestTypeIn, ctx: ManageCatalog, session: SessionDep) -> RequestTypeOut:
    return RequestTypeOut.model_validate(await service.create_type(session, ctx, body.model_dump()))


@router.patch("/request-types/{type_id}", response_model=RequestTypeOut)
async def update_type(type_id: uuid.UUID, body: RequestTypeUpdate, ctx: ManageCatalog, session: SessionDep) -> RequestTypeOut:
    rt = await service.update_type(session, ctx, type_id, body.model_dump(exclude_unset=True))
    return RequestTypeOut.model_validate(rt)


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(
    ctx: TenantCtxDep,
    session: SessionDep,
    segment: Segment | None = None,
    request_type_id: uuid.UUID | None = None,
) -> list[CategoryOut]:
    cats = await service.list_categories(session, ctx.tid, segment, request_type_id)
    return [CategoryOut.model_validate(c) for c in cats]


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryIn, ctx: ManageCatalog, session: SessionDep) -> CategoryOut:
    return CategoryOut.model_validate(await service.create_category(session, ctx, body.model_dump()))


@router.patch("/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: uuid.UUID, body: CategoryUpdate, ctx: ManageCatalog, session: SessionDep
) -> CategoryOut:
    cat = await service.update_category(session, ctx, category_id, body.model_dump(exclude_unset=True))
    return CategoryOut.model_validate(cat)


@router.post(
    "/categories/{category_id}/subcategories", response_model=SubcategoryOut, status_code=status.HTTP_201_CREATED
)
async def create_subcategory(
    category_id: uuid.UUID, body: SubcategoryIn, ctx: ManageCatalog, session: SessionDep
) -> SubcategoryOut:
    return SubcategoryOut.model_validate(
        await service.create_subcategory(session, ctx, category_id, body.model_dump())
    )


@router.patch("/subcategories/{sub_id}", response_model=SubcategoryOut)
async def update_subcategory(
    sub_id: uuid.UUID, body: SubcategoryUpdate, ctx: ManageCatalog, session: SessionDep
) -> SubcategoryOut:
    sub = await service.update_subcategory(session, ctx, sub_id, body.model_dump(exclude_unset=True))
    return SubcategoryOut.model_validate(sub)


@public_router.get("/{slug}/catalog", response_model=PublicCatalogOut)
async def public_catalog(slug: str, session: SessionDep) -> PublicCatalogOut:
    tenant_id = await tenant_id_by_slug(session, slug)
    types = await service.list_types(session, tenant_id, only_active=True)
    cats = await service.list_categories(session, tenant_id, only_active=True)
    return PublicCatalogOut(
        request_types=[PublicRequestType(id=t.id, code=t.code, name=t.name, description=t.description) for t in types],
        categories=[
            PublicCategory(
                id=c.id,
                segment=c.segment,
                request_type_id=c.request_type_id,
                name=c.name,
                description=c.description,
                subcategories=[PublicSubcategory(id=s.id, name=s.name) for s in c.subcategories if s.active],
            )
            for c in cats
        ],
    )

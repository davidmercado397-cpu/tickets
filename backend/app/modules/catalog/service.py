from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.context import Ctx
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.text import slugify
from app.modules.catalog.models import Category, RequestType, Subcategory
from app.modules.catalog.seed_data import CATEGORIES, REQUEST_TYPES
from app.modules.identity.public import area_brief, area_id_by_code


async def seed(session: AsyncSession, tenant_id: uuid.UUID) -> None:
    types: dict[str, uuid.UUID] = {}
    for i, (code, name, desc, rca) in enumerate(REQUEST_TYPES):
        rt = RequestType(tenant_id=tenant_id, code=code, name=name, description=desc, sort_order=i, rca_segments=rca)
        session.add(rt)
        await session.flush()
        types[code] = rt.id
    for i, (segment, code, name, area_code, priority, type_code, subs) in enumerate(CATEGORIES):
        cat = Category(
            tenant_id=tenant_id,
            segment=segment,
            code=code,
            name=name,
            default_area_id=await area_id_by_code(session, tenant_id, area_code),
            default_priority=priority,
            request_type_id=types.get(type_code) if type_code else None,
            sort_order=i,
        )
        session.add(cat)
        await session.flush()
        for sub in subs:
            session.add(Subcategory(tenant_id=tenant_id, category_id=cat.id, code=slugify(sub, 60), name=sub))
    await session.flush()


async def _check_area(session: AsyncSession, ctx: Ctx, area_id: uuid.UUID | None) -> None:
    if area_id is not None and await area_brief(session, ctx.tid, area_id) is None:
        raise ValidationError("El área indicada no existe.")


# --- Tipos de solicitud ---

async def list_types(session: AsyncSession, tenant_id: uuid.UUID, only_active: bool = False) -> list[RequestType]:
    stmt = select(RequestType).where(RequestType.tenant_id == tenant_id).order_by(RequestType.sort_order)
    if only_active:
        stmt = stmt.where(RequestType.active.is_(True))
    return list((await session.execute(stmt)).scalars())


async def create_type(session: AsyncSession, ctx: Ctx, data: dict) -> RequestType:
    code = data.get("code") or slugify(data["name"], 40)
    if (await session.execute(
        select(RequestType.id).where(RequestType.tenant_id == ctx.tid, RequestType.code == code)
    )).first():
        raise ConflictError(f"Ya existe un tipo con código '{code}'.")
    rt = RequestType(tenant_id=ctx.tid, code=code, name=data["name"], description=data.get("description"),
                     sort_order=data.get("sort_order", 0), rca_segments=data.get("rca_segments") or [])
    session.add(rt)
    await session.commit()
    return rt


async def update_type(session: AsyncSession, ctx: Ctx, type_id: uuid.UUID, data: dict) -> RequestType:
    rt = await session.get(RequestType, type_id)
    if rt is None or rt.tenant_id != ctx.tid:
        raise NotFoundError("Tipo de solicitud no encontrado.")
    for key, value in data.items():
        if value is not None:
            setattr(rt, key, value)
    await session.commit()
    return rt


# --- Categorías ---

async def list_categories(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    segment: str | None = None,
    request_type_id: uuid.UUID | None = None,
    only_active: bool = False,
) -> list[Category]:
    stmt = select(Category).where(Category.tenant_id == tenant_id).order_by(Category.sort_order, Category.name)
    if segment:
        stmt = stmt.where(Category.segment == segment)
    if request_type_id:
        stmt = stmt.where((Category.request_type_id == request_type_id) | Category.request_type_id.is_(None))
    if only_active:
        stmt = stmt.where(Category.active.is_(True))
    return list((await session.execute(stmt)).scalars())


async def get_category(session: AsyncSession, tenant_id: uuid.UUID, category_id: uuid.UUID) -> Category:
    stmt = (select(Category).where(Category.id == category_id).options(selectinload(Category.subcategories))
            .execution_options(populate_existing=True))
    cat = (await session.execute(stmt)).scalar_one_or_none()
    if cat is None or cat.tenant_id != tenant_id:
        raise NotFoundError("Categoría no encontrada.")
    return cat


async def create_category(session: AsyncSession, ctx: Ctx, data: dict) -> Category:
    code = data.get("code") or slugify(f"{data['segment'][:3]}_{data['name']}", 60)
    if (await session.execute(
        select(Category.id).where(Category.tenant_id == ctx.tid, Category.code == code)
    )).first():
        raise ConflictError(f"Ya existe una categoría con código '{code}'.")
    await _check_area(session, ctx, data.get("default_area_id"))
    if data.get("request_type_id"):
        rt = await session.get(RequestType, data["request_type_id"])
        if rt is None or rt.tenant_id != ctx.tid:
            raise ValidationError("El tipo de solicitud no existe.")
    cat = Category(tenant_id=ctx.tid, **{**data, "code": code})
    session.add(cat)
    await session.commit()
    return await get_category(session, ctx.tid, cat.id)


async def update_category(session: AsyncSession, ctx: Ctx, category_id: uuid.UUID, data: dict) -> Category:
    cat = await get_category(session, ctx.tid, category_id)
    if "default_area_id" in data:
        await _check_area(session, ctx, data["default_area_id"])
    for key, value in data.items():
        setattr(cat, key, value)
    await session.commit()
    return await get_category(session, ctx.tid, category_id)


async def create_subcategory(session: AsyncSession, ctx: Ctx, category_id: uuid.UUID, data: dict) -> Subcategory:
    cat = await get_category(session, ctx.tid, category_id)
    code = data.get("code") or slugify(data["name"], 60)
    if any(s.code == code for s in cat.subcategories):
        raise ConflictError(f"Ya existe una subcategoría con código '{code}' en esta categoría.")
    await _check_area(session, ctx, data.get("default_area_id"))
    sub = Subcategory(tenant_id=ctx.tid, category_id=cat.id, **{**data, "code": code})
    session.add(sub)
    await session.commit()
    return sub


async def update_subcategory(session: AsyncSession, ctx: Ctx, sub_id: uuid.UUID, data: dict) -> Subcategory:
    sub = await session.get(Subcategory, sub_id)
    if sub is None or sub.tenant_id != ctx.tid:
        raise NotFoundError("Subcategoría no encontrada.")
    if "default_area_id" in data:
        await _check_area(session, ctx, data["default_area_id"])
    for key, value in data.items():
        setattr(sub, key, value)
    await session.commit()
    return sub

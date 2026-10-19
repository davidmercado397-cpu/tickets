"""Fachada pública del catálogo: clasificación de un caso y nombres para listados/reportes."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationError
from app.modules.catalog.models import Category, RequestType, Subcategory


async def resolve(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    segment: str,
    request_type_id: uuid.UUID,
    category_id: uuid.UUID | None,
    subcategory_id: uuid.UUID | None,
) -> dict:
    """Valida la combinación tipo/categoría/subcategoría y devuelve el área y la prioridad sugeridas."""
    rt = await session.get(RequestType, request_type_id)
    if rt is None or rt.tenant_id != tenant_id or not rt.active:
        raise ValidationError("Tipo de solicitud inválido.")
    out = {"area_id": None, "priority": None, "requires_rca": segment in (rt.rca_segments or [])}
    if category_id is None:
        if subcategory_id is not None:
            raise ValidationError("Indica la categoría de la subcategoría.")
        return out
    cat = await session.get(Category, category_id)
    if cat is None or cat.tenant_id != tenant_id or not cat.active:
        raise ValidationError("Categoría inválida.")
    if cat.segment != segment:
        raise ValidationError("La categoría no corresponde al tipo de cliente (interno/externo).")
    if cat.request_type_id is not None and cat.request_type_id != request_type_id:
        raise ValidationError("La categoría no corresponde al tipo de solicitud.")
    out = {**out, "area_id": cat.default_area_id, "priority": cat.default_priority}
    if subcategory_id is not None:
        sub = await session.get(Subcategory, subcategory_id)
        if sub is None or sub.category_id != cat.id or not sub.active:
            raise ValidationError("Subcategoría inválida para la categoría.")
        out["area_id"] = sub.default_area_id or out["area_id"]
        out["priority"] = sub.default_priority or out["priority"]
    return out


async def names(session: AsyncSession, tenant_id: uuid.UUID) -> dict[str, dict[uuid.UUID, str]]:
    """Mapas id→nombre para pintar listados y reportes sin joins entre módulos."""
    types = await session.execute(select(RequestType.id, RequestType.name).where(RequestType.tenant_id == tenant_id))
    cats = await session.execute(select(Category.id, Category.name).where(Category.tenant_id == tenant_id))
    subs = await session.execute(select(Subcategory.id, Subcategory.name).where(Subcategory.tenant_id == tenant_id))
    return {
        "request_types": {r.id: r.name for r in types},
        "categories": {r.id: r.name for r in cats},
        "subcategories": {r.id: r.name for r in subs},
    }


async def request_type_by_code(session: AsyncSession, tenant_id: uuid.UUID, code: str) -> uuid.UUID | None:
    stmt = select(RequestType.id).where(RequestType.tenant_id == tenant_id, RequestType.code == code)
    return (await session.execute(stmt)).scalar_one_or_none()

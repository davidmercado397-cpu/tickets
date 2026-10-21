"""Fachada pública del módulo identity (lo único que otros módulos importan)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.deps import (  # noqa: F401 - re-exportados
    CtxDep,
    SessionDep,
    SuperadminDep,
    TenantCtxDep,
    require,
)
from app.modules.identity.models import Area, User
from app.modules.identity.service import (  # noqa: F401
    create_area,
    create_user,
    is_tenant_admin,
    list_tenant_users,
    platform_update_user,
    seed_roles,
)


async def user_brief(session: AsyncSession, user_id: uuid.UUID | None) -> dict | None:
    if user_id is None:
        return None
    user = await session.get(User, user_id)
    if user is None:
        return None
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "position": user.position,
        "signature_key": user.signature_key,
        "active": user.active,
        "tenant_id": user.tenant_id,
    }


async def user_names(session: AsyncSession, ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    rows = await session.execute(select(User.id, User.full_name).where(User.id.in_(ids)))
    return {r.id: r.full_name for r in rows}


async def area_brief(session: AsyncSession, tenant_id: uuid.UUID, area_id: uuid.UUID | None) -> dict | None:
    if area_id is None:
        return None
    area = await session.get(Area, area_id)
    if area is None or area.tenant_id != tenant_id:
        return None
    return {"id": area.id, "code": area.code, "name": area.name, "email": area.email}


async def area_names(session: AsyncSession, tenant_id: uuid.UUID) -> dict[uuid.UUID, str]:
    rows = await session.execute(select(Area.id, Area.name).where(Area.tenant_id == tenant_id))
    return {r.id: r.name for r in rows}


async def area_id_by_code(session: AsyncSession, tenant_id: uuid.UUID, code: str) -> uuid.UUID | None:
    row = await session.execute(select(Area.id).where(Area.tenant_id == tenant_id, Area.code == code))
    return row.scalar_one_or_none()


async def recipients(
    session: AsyncSession, tenant_id: uuid.UUID, perm: str, area_id: uuid.UUID | None = None
) -> list[dict]:
    """Destinatarios de notificación: usuarios con un permiso (y del área, si se indica)."""
    from app.modules.identity.service import users_with_permission

    users = await users_with_permission(session, tenant_id, perm, area_id)
    return [{"id": u.id, "email": u.email, "full_name": u.full_name} for u in users]

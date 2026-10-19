"""Fachada pública de empleados."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.employees.models import Employee
from app.modules.employees.service import find_by_document, normalize_document  # noqa: F401


async def employee_brief(session: AsyncSession, tenant_id: uuid.UUID, employee_id: uuid.UUID | None) -> dict | None:
    if employee_id is None:
        return None
    e = await session.get(Employee, employee_id)
    if e is None or e.tenant_id != tenant_id:
        return None
    return {"id": e.id, "document_type": e.document_type, "document": e.document, "full_name": e.full_name,
            "email": e.email, "phone": e.phone, "position": e.position, "site_id": e.site_id}


async def names(session: AsyncSession, tenant_id: uuid.UUID) -> dict[uuid.UUID, str]:
    rows = await session.execute(select(Employee.id, Employee.full_name).where(Employee.tenant_id == tenant_id))
    return {r.id: r.full_name for r in rows}

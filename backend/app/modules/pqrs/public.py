"""Fachada pública del módulo PQRS (la usan canales, notificaciones, reportes y tareas)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.pqrs.models import FINAL_STATUSES, STATUSES, Pqrs, PqrsResponse  # noqa: F401
from app.modules.pqrs.service import UploadedFile, create_pqrs, sla_scan, sla_state  # noqa: F401


async def pqrs_brief(session: AsyncSession, pqrs_id: uuid.UUID) -> dict | None:
    p = await session.get(Pqrs, pqrs_id)
    if p is None:
        return None
    return {
        "id": p.id, "tenant_id": p.tenant_id, "radicado": p.radicado, "public_code": p.public_code,
        "subject": p.subject, "status": p.status, "priority": p.priority, "segment": p.segment,
        "area_id": p.area_id, "assignee_id": p.assignee_id, "requester_name": p.requester_name,
        "requester_email": p.requester_email, "sla_due_at": p.sla_due_at, "is_anonymous": p.is_anonymous,
        "client_id": p.client_id, "site_id": p.site_id,
    }


async def exists_external_ref(session: AsyncSession, tenant_id: uuid.UUID, ref: str) -> bool:
    stmt = select(Pqrs.id).where(Pqrs.tenant_id == tenant_id, Pqrs.external_ref == ref)
    return (await session.execute(stmt)).first() is not None


async def report_rows(session: AsyncSession, tenant_id: uuid.UUID, filters: dict) -> list[Pqrs]:
    """Casos para reportes (filtros: from, to, segment, area_id, client_id)."""
    stmt = select(Pqrs).where(Pqrs.tenant_id == tenant_id)
    if filters.get("from"):
        stmt = stmt.where(Pqrs.created_at >= filters["from"])
    if filters.get("to"):
        stmt = stmt.where(Pqrs.created_at <= filters["to"])
    for key in ("segment", "area_id", "client_id", "request_type_id"):
        if filters.get(key):
            stmt = stmt.where(getattr(Pqrs, key) == filters[key])
    return list((await session.execute(stmt.order_by(Pqrs.created_at))).scalars())


async def response_pdf(session: AsyncSession, response_id: uuid.UUID) -> tuple[str | None, str | None]:
    r = await session.get(PqrsResponse, response_id)
    return (r.pdf_key, r.body) if r else (None, None)

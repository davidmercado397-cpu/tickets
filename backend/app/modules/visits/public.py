"""Fachada pública de visitas (reportes, integraciones con minutas)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.visits.models import Visit
from app.modules.visits.service import compliance, month_range, set_quota_count  # noqa: F401


async def report_rows(session: AsyncSession, tenant_id: uuid.UUID, month: str | None = None) -> list[dict]:
    stmt = select(Visit).where(Visit.tenant_id == tenant_id, Visit.status == "completed")
    if month:
        start, end = await month_range(session, tenant_id, month)
        stmt = stmt.where(Visit.completed_at >= start, Visit.completed_at < end)
    return [{"id": v.id, "client_id": v.client_id, "site_id": v.site_id, "visitor_id": v.visitor_id,
             "completed_at": v.completed_at, "score": v.score, "findings": len(v.findings or []),
             "form": (v.form_snapshot or {}).get("name")}
            for v in (await session.execute(stmt)).scalars()]

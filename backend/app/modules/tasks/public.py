"""Fachada pública de tareas (la usan visitas, PQRS, reportes e integraciones)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tasks.models import Task
from app.modules.tasks.service import create_task, is_overdue  # noqa: F401


async def tasks_for_source(session: AsyncSession, tenant_id: uuid.UUID, source_type: str, source_id: uuid.UUID) -> list[dict]:
    rows = (await session.execute(
        select(Task).where(Task.tenant_id == tenant_id, Task.source_type == source_type, Task.source_id == source_id)
    )).scalars()
    return [{"id": t.id, "title": t.title, "status": t.status, "due_date": t.due_date,
             "assignee_id": t.assignee_id, "overdue": is_overdue(t)} for t in rows]


async def report_rows(session: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    rows = (await session.execute(select(Task).where(Task.tenant_id == tenant_id))).scalars()
    return [{"status": t.status, "source_type": t.source_type, "assignee_id": t.assignee_id, "due_date": t.due_date,
             "completed_at": t.completed_at, "created_at": t.created_at, "overdue": is_overdue(t),
             "client_id": t.client_id, "site_id": t.site_id} for t in rows]

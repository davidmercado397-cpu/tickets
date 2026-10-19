from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.context import Ctx
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.core.events import commit_and_dispatch, emit
from app.core.storage import new_key, storage
from app.modules.clients import public as clients
from app.modules.identity import public as identity
from app.modules.tasks.models import Task, TaskUpdate


def _today() -> date:
    return datetime.now(timezone.utc).date()


def is_overdue(t: Task) -> bool:
    return bool(t.due_date and t.status in ("open", "in_progress") and t.due_date < _today())


def _scope(ctx: Ctx):
    if ctx.can("tasks.view_all") or ctx.integration:
        return None
    return or_(Task.assignee_id == ctx.user_id, Task.created_by_id == ctx.user_id)


async def get_task(session: AsyncSession, ctx: Ctx, task_id: uuid.UUID) -> Task:
    stmt = (select(Task).where(Task.id == task_id, Task.tenant_id == ctx.tid)
            .options(selectinload(Task.updates)).execution_options(populate_existing=True))
    cond = _scope(ctx)
    if cond is not None:
        stmt = stmt.where(cond)
    task = (await session.execute(stmt)).scalar_one_or_none()
    if task is None:
        raise NotFoundError("Tarea no encontrada.")
    return task


async def _check_assignee(session: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID | None) -> None:
    if user_id is None:
        return
    u = await identity.user_brief(session, user_id)
    if u is None or u["tenant_id"] != tenant_id or not u["active"]:
        raise ValidationError("El responsable no existe o está inactivo.")


async def create_task(session: AsyncSession, ctx: Ctx, data: dict, *, commit: bool = True) -> Task:
    await _check_assignee(session, ctx.tid, data.get("assignee_id"))
    client_id, site_id = await clients.validate_client_site(session, ctx.tid, data.get("client_id"), data.get("site_id"))
    task = Task(tenant_id=ctx.tid, created_by_id=ctx.user_id, **{**data, "client_id": client_id, "site_id": site_id})
    session.add(task)
    await session.flush()
    session.add(TaskUpdate(task_id=task.id, author_id=ctx.user_id, author_label=ctx.actor_label,
                           to_status="open", note="Tarea creada."))
    if task.assignee_id:
        emit(session, "task.assigned", ctx.tid, task_id=task.id, assignee_id=task.assignee_id, title=task.title,
             description=task.description, due_date=task.due_date.isoformat() if task.due_date else None,
             by=ctx.user_id)
    if commit:
        await commit_and_dispatch(session)
    return task


async def update_task(session: AsyncSession, ctx: Ctx, task_id: uuid.UUID, data: dict) -> Task:
    task = await get_task(session, ctx, task_id)
    if not ctx.can("tasks.manage"):
        raise ForbiddenError("Solo quien gestiona tareas puede editarlas.")
    if "assignee_id" in data and data["assignee_id"] != task.assignee_id:
        await _check_assignee(session, ctx.tid, data["assignee_id"])
        if data["assignee_id"]:
            emit(session, "task.assigned", ctx.tid, task_id=task.id, assignee_id=data["assignee_id"],
                 title=data.get("title") or task.title, description=task.description,
                 due_date=task.due_date.isoformat() if task.due_date else None, by=ctx.user_id)
    for key, value in data.items():
        setattr(task, key, value)
    session.add(TaskUpdate(task_id=task.id, author_id=ctx.user_id, author_label=ctx.actor_label,
                           note="Tarea editada: " + ", ".join(sorted(data))))
    await commit_and_dispatch(session)
    return await get_task(session, ctx, task_id)


async def add_update(
    session: AsyncSession, ctx: Ctx, task_id: uuid.UUID, note: str | None, status: str | None,
    files: list[tuple[str, str, bytes]],
) -> Task:
    task = await get_task(session, ctx, task_id)
    if not (ctx.can("tasks.manage") or task.assignee_id == ctx.user_id):
        raise ForbiddenError("Solo el responsable o quien gestiona tareas puede registrar avances.")
    if not note and not status and not files:
        raise ValidationError("Escribe una nota, cambia el estado o adjunta evidencia.")
    max_bytes = get_settings().MAX_UPLOAD_MB * 1024 * 1024
    stored = []
    for filename, mime, data in files[:10]:
        if len(data) > max_bytes:
            raise ValidationError(f"'{filename}' supera el tamaño máximo.")
        key = new_key(ctx.tid, f"tasks/{task.id}", filename)
        await storage().put(key, data, mime)
        stored.append({"key": key, "filename": filename[:200], "mime": mime, "size": len(data)})
    old = task.status
    if status and status != old:
        if old in ("done", "cancelled") and not ctx.can("tasks.manage"):
            raise ForbiddenError("Reabrir una tarea requiere permiso de gestión.")
        task.status = status
        task.completed_at = datetime.now(timezone.utc) if status == "done" else None
    session.add(TaskUpdate(task_id=task.id, author_id=ctx.user_id, author_label=ctx.actor_label, note=note,
                           from_status=old if status and status != old else None,
                           to_status=status if status and status != old else None, files=stored))
    if status == "done" and old != "done":
        emit(session, "task.completed", ctx.tid, task_id=task.id, source_type=task.source_type, source_id=task.source_id)
    await commit_and_dispatch(session)
    return await get_task(session, ctx, task_id)


def _filters(stmt: Select, ctx: Ctx, f: dict) -> Select:
    stmt = stmt.where(Task.tenant_id == ctx.tid)
    cond = _scope(ctx)
    if cond is not None:
        stmt = stmt.where(cond)
    if f.get("q"):
        stmt = stmt.where(Task.title.ilike(f"%{f['q']}%"))
    for col in ("status", "assignee_id", "source_type", "source_id", "client_id", "site_id", "priority"):
        if f.get(col):
            stmt = stmt.where(getattr(Task, col) == f[col])
    if f.get("mine"):
        stmt = stmt.where(Task.assignee_id == ctx.user_id)
    if f.get("open_only"):
        stmt = stmt.where(Task.status.in_(("open", "in_progress")))
    if f.get("overdue"):
        stmt = stmt.where(Task.status.in_(("open", "in_progress")), Task.due_date < _today())
    return stmt


async def list_tasks(session: AsyncSession, ctx: Ctx, f: dict, page: int, page_size: int) -> tuple[list[Task], int]:
    base = _filters(select(Task), ctx, f)
    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = await session.execute(
        base.order_by(Task.status.in_(("done", "cancelled")), Task.due_date.is_(None), Task.due_date, Task.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    return list(rows.scalars()), total

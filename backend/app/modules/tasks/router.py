from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status

from app.core.context import Ctx
from app.core.errors import NotFoundError
from app.core.storage import storage
from app.modules.clients import public as clients
from app.modules.identity import public as identity
from app.modules.identity.public import SessionDep, TenantCtxDep, require
from app.modules.tasks import service
from app.modules.tasks.models import Task
from app.modules.tasks.schemas import FileOut, Named, Priority, TaskIn, TaskOut, TaskPage, TaskPatch, TaskStatus, TaskUpdateOut
from app.modules.tenancy.public import IntegrationCtxDep

router = APIRouter(prefix="/tasks", tags=["tareas"])
integration_router = APIRouter(prefix="/integrations", tags=["integraciones"])
ManageTasks = Annotated[Ctx, Depends(require("tasks.manage"))]


async def to_out(session, ctx: Ctx, tasks: list[Task], with_updates: bool = False) -> list[TaskOut]:
    users = await identity.user_names(session, {i for t in tasks for i in (t.assignee_id, t.created_by_id) if i})
    names = await clients.names(session, ctx.tid)

    def named(m: dict, key):
        return Named(id=key, name=m.get(key, "—")) if key else None

    out = []
    for t in tasks:
        item = TaskOut(
            id=t.id, title=t.title, description=t.description, status=t.status, priority=t.priority,
            due_date=t.due_date, overdue=service.is_overdue(t), assignee=named(users, t.assignee_id),
            created_by=named(users, t.created_by_id), source_type=t.source_type, source_id=t.source_id,
            source_label=t.source_label, client=named(names["clients"], t.client_id),
            site=named(names["sites"], t.site_id), completed_at=t.completed_at, created_at=t.created_at,
        )
        if with_updates:
            item.updates = [
                TaskUpdateOut(id=u.id, at=u.at, author_label=u.author_label, note=u.note, from_status=u.from_status,
                              to_status=u.to_status,
                              files=[FileOut(index=i, filename=f["filename"], mime=f["mime"], size=f["size"])
                                     for i, f in enumerate(u.files or [])])
                for u in t.updates
            ]
        out.append(item)
    return out


@router.get("", response_model=TaskPage)
async def list_tasks(
    ctx: TenantCtxDep,
    session: SessionDep,
    q: str | None = None,
    status_: Annotated[TaskStatus | None, Query(alias="status")] = None,
    priority: Priority | None = None,
    assignee_id: uuid.UUID | None = None,
    source_type: str | None = None,
    source_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    site_id: uuid.UUID | None = None,
    mine: bool = False,
    open_only: bool = False,
    overdue: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
) -> TaskPage:
    f = dict(q=q, status=status_, priority=priority, assignee_id=assignee_id, source_type=source_type,
             source_id=source_id, client_id=client_id, site_id=site_id, mine=mine, open_only=open_only, overdue=overdue)
    items, total = await service.list_tasks(session, ctx, f, page, page_size)
    return TaskPage(items=await to_out(session, ctx, items), total=total, page=page, page_size=page_size)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskIn, ctx: ManageTasks, session: SessionDep) -> TaskOut:
    task = await service.create_task(session, ctx, body.model_dump())
    return (await to_out(session, ctx, [await service.get_task(session, ctx, task.id)], True))[0]


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: uuid.UUID, ctx: TenantCtxDep, session: SessionDep) -> TaskOut:
    return (await to_out(session, ctx, [await service.get_task(session, ctx, task_id)], True))[0]


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: uuid.UUID, body: TaskPatch, ctx: ManageTasks, session: SessionDep) -> TaskOut:
    task = await service.update_task(session, ctx, task_id, body.model_dump(exclude_unset=True))
    return (await to_out(session, ctx, [task], True))[0]


@router.post("/{task_id}/updates", response_model=TaskOut)
async def add_update(
    task_id: uuid.UUID,
    ctx: TenantCtxDep,
    session: SessionDep,
    note: Annotated[str | None, Form()] = None,
    status_: Annotated[TaskStatus | None, Form(alias="status")] = None,
    files: list[UploadFile] | None = File(None),
) -> TaskOut:
    payload = [(f.filename, f.content_type or "application/octet-stream", await f.read()) for f in files or [] if f.filename]
    task = await service.add_update(session, ctx, task_id, note, status_, payload)
    return (await to_out(session, ctx, [task], True))[0]


@router.get("/{task_id}/updates/{update_id}/files/{index}")
async def download(task_id: uuid.UUID, update_id: uuid.UUID, index: int, ctx: TenantCtxDep, session: SessionDep) -> Response:
    task = await service.get_task(session, ctx, task_id)
    upd = next((u for u in task.updates if u.id == update_id), None)
    if upd is None or index >= len(upd.files or []):
        raise NotFoundError("Archivo no encontrado.")
    f = upd.files[index]
    return Response(await storage().get(f["key"]), media_type=f["mime"],
                    headers={"Content-Disposition": f'inline; filename="{f["filename"]}"'})


@integration_router.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def integration_create(body: TaskIn, ctx: IntegrationCtxDep, session: SessionDep) -> TaskOut:
    """Crea tareas desde otros sistemas (p. ej. el módulo de minutas)."""
    task = await service.create_task(session, ctx, body.model_dump())
    return (await to_out(session, ctx, [await service.get_task(session, ctx, task.id)], True))[0]

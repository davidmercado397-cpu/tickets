from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.modules.identity.public import CtxDep, SessionDep
from app.modules.notifications import service

router = APIRouter(prefix="/notifications", tags=["notificaciones"])


class NotificationOut(BaseModel):
    id: str
    kind: str
    title: str
    body: str | None
    link: str | None
    read: bool
    created_at: str


class CountOut(BaseModel):
    unread: int


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    ctx: CtxDep, session: SessionDep, unread_only: bool = False, limit: int = Query(30, ge=1, le=100)
) -> list[NotificationOut]:
    items = await service.list_for(session, ctx.user_id, unread_only, limit)
    return [NotificationOut(**service.serialize(n)) for n in items]


@router.get("/unread-count", response_model=CountOut)
async def unread(ctx: CtxDep, session: SessionDep) -> CountOut:
    return CountOut(unread=await service.unread_count(session, ctx.user_id))


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def read_one(notification_id: uuid.UUID, ctx: CtxDep, session: SessionDep) -> None:
    await service.mark_read(session, ctx.user_id, notification_id)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def read_all(ctx: CtxDep, session: SessionDep) -> None:
    await service.mark_read(session, ctx.user_id, None)


@router.get("/stream")
async def stream(ctx: CtxDep, session: SessionDep) -> StreamingResponse:
    """SSE (event: notification). Acepta `?access_token=` porque EventSource no envía cabeceras."""
    await session.close()  # no retener una conexión de BD durante todo el stream
    return StreamingResponse(
        service.stream(ctx.user_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

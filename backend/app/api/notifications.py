"""Feed de notificaciones internas del usuario autenticado + stream SSE en tiempo real.

Cada usuario ve/gestiona SOLO sus notificaciones (require_user resuelve el user_id; el repo filtra por
él). El front puede pollear los GET o abrir el stream `/stream` para push instantáneo."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.api.schemas import NotificationOut, to_notification_out
from app.dependencies import (
    NotificationBusDep,
    NotificationRepoDep,
    SettingsDep,
    UserContextDep,
)
from app.services.sse import notification_stream

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", summary="Mis notificaciones")
async def list_notifications(
    user: UserContextDep,
    repo: NotificationRepoDep,
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[NotificationOut]:
    items = await repo.list_for_user(user.user_id, unread_only=unread_only, limit=limit)
    return [to_notification_out(n) for n in items]


@router.get("/unread-count", summary="Conteo de no leídas")
async def unread_count(user: UserContextDep, repo: NotificationRepoDep) -> dict[str, int]:
    return {"count": await repo.unread_count(user.user_id)}


@router.post("/read-all", summary="Marcar todas como leídas")
async def mark_all_read(user: UserContextDep, repo: NotificationRepoDep) -> dict[str, int]:
    return {"marked": await repo.mark_all_read(user.user_id)}


@router.post("/{notification_id}/read", summary="Marcar una como leída")
async def mark_read(
    notification_id: uuid.UUID, user: UserContextDep, repo: NotificationRepoDep
) -> dict[str, bool]:
    if not await repo.mark_read(user.user_id, notification_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notificación no encontrada."
        )
    return {"ok": True}


@router.get("/stream", summary="Stream SSE de notificaciones en tiempo real")
async def stream(
    user: UserContextDep, bus: NotificationBusDep, settings: SettingsDep
) -> StreamingResponse:
    return StreamingResponse(
        notification_stream(bus, user.user_id, settings.SSE_HEARTBEAT_SECONDS),
        media_type="text/event-stream",
    )

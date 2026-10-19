"""Entrega de notificaciones: in-app (BD + Redis pub/sub → SSE) y correo (cola del worker)."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, AsyncIterator

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import utcnow
from app.core.jobs import enqueue, get_redis
from app.modules.notifications.models import Notification

logger = logging.getLogger(__name__)


def _channel(user_id: uuid.UUID) -> str:
    return f"notif:user:{user_id}"


def serialize(n: Notification) -> dict[str, Any]:
    return {
        "id": str(n.id), "kind": n.kind, "title": n.title, "body": n.body, "link": n.link,
        "read": n.read_at is not None, "created_at": n.created_at.isoformat(),
    }


async def notify(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    users: list[dict],
    *,
    kind: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    email: bool = False,
    email_html: str | None = None,
    exclude: uuid.UUID | None = None,
) -> None:
    """Notifica a varios usuarios (dicts con id/email). `exclude`: no avisar a quien hizo la acción."""
    seen: set[uuid.UUID] = set()
    created: list[Notification] = []
    for u in users:
        if u["id"] in seen or u["id"] == exclude:
            continue
        seen.add(u["id"])
        n = Notification(tenant_id=tenant_id, user_id=u["id"], kind=kind, title=title, body=body, link=link)
        session.add(n)
        created.append(n)
    await session.commit()
    for n in created:
        try:
            await get_redis().publish(_channel(n.user_id), json.dumps(serialize(n)))
        except Exception:  # noqa: BLE001 - el SSE es efímero; la verdad está en la BD
            logger.warning("No se pudo publicar la notificación en Redis")
    if email and email_html:
        to = [u["email"] for u in users if u["id"] in seen and u.get("email")]
        if to:
            await enqueue("send_email", {"to": to, "subject": title, "html": email_html})


async def list_for(session: AsyncSession, user_id: uuid.UUID, unread_only: bool, limit: int) -> list[Notification]:
    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    return list((await session.execute(stmt.order_by(Notification.created_at.desc()).limit(limit))).scalars())


async def unread_count(session: AsyncSession, user_id: uuid.UUID) -> int:
    stmt = select(func.count()).where(Notification.user_id == user_id, Notification.read_at.is_(None))
    return (await session.execute(stmt)).scalar_one()


async def mark_read(session: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID | None) -> None:
    stmt = update(Notification).where(Notification.user_id == user_id, Notification.read_at.is_(None))
    if notification_id:
        stmt = stmt.where(Notification.id == notification_id)
    await session.execute(stmt.values(read_at=utcnow()))
    await session.commit()


async def stream(user_id: uuid.UUID) -> AsyncIterator[str]:
    """SSE: un pump lee el pub/sub hacia una cola; el heartbeat va sobre la cola (no corta la suscripción)."""
    queue: asyncio.Queue[str] = asyncio.Queue()
    heartbeat = get_settings().SSE_HEARTBEAT_SECONDS

    async def pump() -> None:
        pubsub = get_redis().pubsub()
        await pubsub.subscribe(_channel(user_id))
        try:
            async for message in pubsub.listen():
                if message.get("type") == "message":
                    await queue.put(message["data"])
        finally:
            await pubsub.unsubscribe(_channel(user_id))
            await pubsub.aclose()

    task = asyncio.create_task(pump())
    try:
        yield "retry: 5000\n\n"
        while True:
            try:
                data = await asyncio.wait_for(queue.get(), timeout=heartbeat)
                yield f"event: notification\ndata: {data}\n\n"
            except asyncio.TimeoutError:
                yield ": ping\n\n"
    finally:
        task.cancel()

"""Bus de notificaciones en tiempo real sobre Redis pub/sub (para el SSE del feed).

Aislado por usuario: cada quien se suscribe a su canal `notif:user:{id}`. Es efímero (si nadie
escucha, se pierde): la verdad está en Postgres (`notifications`), así que al (re)conectar el front
hace un GET para ponerse al día. Espeja el enfoque del inbox del Gateway."""

from __future__ import annotations

import json
import uuid
from typing import Any, AsyncIterator

import redis.asyncio as redis

from app.domain.models import Notification


def serialize(n: Notification) -> dict[str, Any]:
    """Payload de red (wire) de una notificación."""
    return {
        "id": str(n.id),
        "type": n.type.value,
        "title": n.title,
        "body": n.body,
        "ticket_id": str(n.ticket_id) if n.ticket_id else None,
        "radicado": n.radicado,
        "read": n.read,
        "created_at": n.created_at.isoformat(),
    }


class RedisNotificationBus:
    def __init__(self, client: redis.Redis) -> None:
        self._redis = client

    @staticmethod
    def _channel(user_id: uuid.UUID) -> str:
        return f"notif:user:{user_id}"

    async def publish(self, user_id: uuid.UUID, notification: Notification) -> None:
        await self._redis.publish(self._channel(user_id), json.dumps(serialize(notification)))

    async def subscribe(self, user_id: uuid.UUID) -> AsyncIterator[dict[str, Any]]:
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(self._channel(user_id))
        try:
            async for message in pubsub.listen():
                if message.get("type") == "message":
                    yield json.loads(message["data"])
        finally:
            await pubsub.unsubscribe(self._channel(user_id))
            await pubsub.aclose()

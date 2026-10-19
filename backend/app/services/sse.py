"""Stream SSE del feed de notificaciones de un usuario.

Detalle (igual que el inbox del Gateway): el heartbeat NO envuelve `subscribe()` en `wait_for` (eso
cerraría la suscripción en cada ping) → una tarea bombea los eventos del bus a una `asyncio.Queue` y el
timeout se aplica sobre `queue.get()`."""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import AsyncIterator

from app.domain.ports import NotificationBus


async def notification_stream(
    bus: NotificationBus, user_id: uuid.UUID, heartbeat_seconds: float
) -> AsyncIterator[str]:
    queue: asyncio.Queue[dict] = asyncio.Queue()

    async def _pump() -> None:
        async for payload in bus.subscribe(user_id):
            await queue.put(payload)

    pump_task = asyncio.create_task(_pump())
    try:
        while True:
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=heartbeat_seconds)
                yield f"event: notification\ndata: {json.dumps(payload)}\n\n"
            except asyncio.TimeoutError:
                yield ": ping\n\n"  # mantiene viva la conexión y detecta cortes
    finally:
        pump_task.cancel()

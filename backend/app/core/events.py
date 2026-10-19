"""Eventos de dominio en proceso: el pegamento desacoplado entre módulos.

Un módulo `emit()`e un evento dentro de su transacción; los eventos se despachan DESPUÉS del commit
(`commit_and_dispatch`) para que ningún oyente vea datos que luego se revierten. Cada oyente corre con
su propia sesión y sus fallos se registran sin afectar a quien emitió (best-effort)."""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Event:
    name: str
    tenant_id: Any
    payload: dict[str, Any] = field(default_factory=dict)


Handler = Callable[[Event], Awaitable[None]]
_handlers: dict[str, list[Handler]] = defaultdict(list)


def subscribe(name: str) -> Callable[[Handler], Handler]:
    """Decorador: `@subscribe("pqrs.assigned")`."""

    def deco(fn: Handler) -> Handler:
        _handlers[name].append(fn)
        return fn

    return deco


def emit(session: AsyncSession, name: str, tenant_id: Any, **payload: Any) -> None:
    session.info.setdefault("events", []).append(Event(name, tenant_id, payload))


async def dispatch(events: list[Event]) -> None:
    for event in events:
        for handler in _handlers.get(event.name, []):
            try:
                await handler(event)
            except Exception:  # noqa: BLE001 - un oyente roto no tumba al emisor
                logger.exception("Fallo en oyente de evento", extra={"event": event.name})


async def commit_and_dispatch(session: AsyncSession) -> None:
    """Commit de la unidad de trabajo y despacho de los eventos acumulados."""
    events: list[Event] = session.info.pop("events", [])
    await session.commit()
    if events:
        await dispatch(events)

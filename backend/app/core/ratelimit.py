"""Límite de peticiones por IP (ventana fija en Redis) para los endpoints públicos."""

from __future__ import annotations

import logging

from fastapi import Request

from app.core.errors import DomainError
from app.core.jobs import get_redis

logger = logging.getLogger(__name__)


class TooManyRequests(DomainError):
    status_code = 429


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "desconocida"


async def enforce_rate_limit(request: Request, bucket: str, limit_per_hour: int) -> None:
    key = f"rl:{bucket}:{client_ip(request)}"
    try:
        r = get_redis()
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, 3600)
    except Exception:  # noqa: BLE001 - sin Redis no bloqueamos al ciudadano
        logger.warning("Rate limit no disponible (Redis)")
        return
    if count > limit_per_hour:
        raise TooManyRequests("Demasiadas solicitudes. Intenta de nuevo más tarde.")

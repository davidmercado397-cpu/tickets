"""Emisión/validación de JWT de sesión (HS256) para usuarios humanos.

El token lleva el `sub` (user_id). El rol y el estado (active) se resuelven de la BD en cada request
(no en el claim) para que desactivar/recategorizar a un usuario tenga efecto inmediato."""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

import jwt

_ALGO = "HS256"


def issue_access_token(*, user_id: uuid.UUID, signing_key: str, ttl_seconds: int) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + dt.timedelta(seconds=ttl_seconds),
    }
    return jwt.encode(payload, signing_key, algorithm=_ALGO)


def decode_access_token(token: str, signing_key: str) -> dict[str, Any]:
    """Devuelve los claims. Lanza `jwt.PyJWTError` (expirado / firma inválida)."""
    return jwt.decode(token, signing_key, algorithms=[_ALGO])

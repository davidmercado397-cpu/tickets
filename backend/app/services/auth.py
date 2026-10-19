"""Autenticación por service-token (Bearer) para el incremento 1.

El Gateway llama a esta API con `Authorization: Bearer <TICKETING_SERVICE_TOKEN>`. Se compara en
tiempo constante (`hmac.compare_digest`) contra el token configurado. Si no coincide → sin Principal
(la dependencia devuelve 401). El RBAC de usuarios humanos llega en un incremento posterior."""

from __future__ import annotations

import hmac

from app.domain.models import Principal


def verify_service_token(provided: str | None, expected: str) -> Principal | None:
    """Devuelve un `Principal` si el token coincide; `None` si falta o no coincide.

    Si `expected` está vacío (mala config), rechaza siempre (mejor cerrado que abierto)."""
    if not expected or not provided:
        return None
    if hmac.compare_digest(provided, expected):
        return Principal(kind="service", label="gateway-bot")
    return None

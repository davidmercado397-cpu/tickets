"""Errores de dominio (puros: no conocen FastAPI).

Los servicios lanzan estos errores; un exception handler en `main.py` los traduce a HTTPException con
el `status_code` correspondiente y `{"detail": ...}` (calca el schema `Error` del contrato). Así el
dominio no depende del framework web."""

from __future__ import annotations


class DomainError(Exception):
    """Base. `status_code` mapea al HTTP que devolverá la API."""

    status_code: int = 400


class NotFoundError(DomainError):
    status_code = 404


class ConflictError(DomainError):
    status_code = 409


class ValidationError(DomainError):
    status_code = 422

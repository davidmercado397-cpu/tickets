"""Errores de dominio (no conocen FastAPI). `main.py` los traduce a HTTP con `{"detail": ...}`."""

from __future__ import annotations


class DomainError(Exception):
    status_code: int = 400


class NotFoundError(DomainError):
    status_code = 404


class ConflictError(DomainError):
    status_code = 409


class ValidationError(DomainError):
    status_code = 422


class ForbiddenError(DomainError):
    status_code = 403


class UnauthorizedError(DomainError):
    status_code = 401


class ServiceUnavailableError(DomainError):
    status_code = 503

"""Número de radicado: formato + año local.

`{PREFIX}-{YYYY}-{NNNNNN}` (p.ej. SRV-2026-000123). La secuencia anual (NNNNNN) la asigna de forma
atómica el repositorio de tickets (tabla `counters`); aquí solo se formatea y se calcula el año.

El año sigue el **calendario local** (Colombia, GMT-5) y no UTC: así un ticket radicado el 31-dic por la
noche hora Colombia queda en la vigencia correcta y no salta al año siguiente por el desfase UTC."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


def local_year(offset_hours: int, now_utc: datetime | None = None) -> int:
    """Año en la zona local (UTC + offset). `now_utc` se inyecta en tests para fijar el instante."""
    now = now_utc or datetime.now(timezone.utc)
    return (now + timedelta(hours=offset_hours)).year


def format_radicado(prefix: str, year: int, seq: int) -> str:
    """`PREFIX-YYYY-NNNNNN`. Si el prefijo está vacío, se omite (sin guion inicial)."""
    base = f"{year}-{seq:06d}"
    return f"{prefix}-{base}" if prefix else base

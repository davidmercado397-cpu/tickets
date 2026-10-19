"""SLA por prioridad (calendario 24/7): cálculo de vencimientos + gestión de políticas.

Al crear un ticket, `due_dates` devuelve los vencimientos de respuesta y resolución sumando los minutos
de la política de su prioridad. Si no hay política para esa prioridad, no hay SLA (None)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.domain.errors import ValidationError
from app.domain.models import Priority, SlaPolicy
from app.domain.ports import SlaPolicyRepository


class SlaService:
    def __init__(self, policies: SlaPolicyRepository) -> None:
        self._policies = policies

    async def due_dates(
        self, priority: Priority, base: datetime | None = None
    ) -> tuple[datetime | None, datetime | None]:
        """(response_due_at, resolution_due_at) para la prioridad, desde `base` (ahora por defecto)."""
        policy = await self._policies.get(priority)
        if policy is None:
            return None, None
        start = base or datetime.now(timezone.utc)
        return (
            start + timedelta(minutes=policy.response_minutes),
            start + timedelta(minutes=policy.resolution_minutes),
        )

    async def list_policies(self) -> list[SlaPolicy]:
        return await self._policies.list()

    async def upsert_policy(
        self, priority: Priority, response_minutes: int, resolution_minutes: int
    ) -> SlaPolicy:
        if response_minutes <= 0 or resolution_minutes <= 0:
            raise ValidationError("Los minutos de SLA deben ser positivos.")
        if resolution_minutes < response_minutes:
            raise ValidationError(
                "El tiempo de resolución no puede ser menor que el de respuesta."
            )
        return await self._policies.upsert(priority, response_minutes, resolution_minutes)

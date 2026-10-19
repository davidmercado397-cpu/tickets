"""Lógica de tickets: crear (validar categoría → derivar área), consultar, listar, actualizar.

Depende de los puertos (repos), no de SQLAlchemy. Reglas clave:
- La `category` (code) es requerida y determina el `area` (categoría 1—* área).
- `area` es un hint opcional de cross-check: en mismatch se ACEPTA, se deriva de la categoría y se
  loguea un warning (nunca se pierde el ticket). Ver decisión en el plan."""

from __future__ import annotations

import logging
import uuid

from app.domain.errors import NotFoundError, ValidationError
from app.domain.models import (
    Attachment,
    Contact,
    HistoryActor,
    Priority,
    Ticket,
    TicketCreateData,
    TicketFilters,
    TicketStatus,
    TicketSummary,
)
from app.domain.ports import CategoryRepository, TicketRepository
from app.services.radicado import local_year
from app.services.sla_service import SlaService

logger = logging.getLogger(__name__)


class TicketService:
    def __init__(
        self,
        tickets: TicketRepository,
        categories: CategoryRepository,
        sla: SlaService,
        radicado_prefix: str,
        tz_offset_hours: int,
        default_priority: Priority,
    ) -> None:
        self._tickets = tickets
        self._categories = categories
        self._sla = sla
        self._radicado_prefix = radicado_prefix
        # Desfase de la zona local (Colombia = -5): el año del radicado sigue el calendario local.
        self._tz_offset_hours = tz_offset_hours
        self._default_priority = default_priority

    async def create(
        self,
        *,
        category_code: str,
        contact: Contact,
        area_hint: str | None = None,
        priority: Priority | None = None,
        subject: str | None = None,
        description: str | None = None,
        channel: str | None = None,
        conversation_id: str | None = None,
        fields: dict | None = None,
        attachments: list[Attachment] | None = None,
    ) -> Ticket:
        category = await self._categories.get_by_code(category_code)
        if category is None or not category.active:
            # 422: referencia inválida. El bot debe mandar un code de categoría válido y activo.
            raise ValidationError(
                f"La categoría '{category_code}' no existe o está inactiva."
            )

        # Cross-check del hint de área: la categoría es la fuente de verdad; en mismatch, warning.
        if area_hint and area_hint != category.area_code:
            logger.warning(
                "El área enviada no coincide con la de la categoría; se usa la de la categoría.",
                extra={
                    "category": category.code,
                    "area": category.area_code,
                    "area_hint": area_hint,
                    "conversation_id": conversation_id,
                },
            )

        # Prioridad efectiva (default si el bot no la mandó) → define el SLA.
        effective_priority = priority or self._default_priority
        response_due, resolution_due = await self._sla.due_dates(effective_priority)

        data = TicketCreateData(
            category_id=category.id,
            area_id=category.area_id,
            contact=contact,
            priority=effective_priority,
            subject=subject,
            description=description,
            channel=channel,
            conversation_id=conversation_id,
            fields=fields or {},
            attachments=attachments or [],
            initial_actor=HistoryActor.ai,  # lo crea el bot en nombre del usuario
            response_due_at=response_due,
            resolution_due_at=resolution_due,
        )
        year = local_year(self._tz_offset_hours)
        return await self._tickets.create(data, self._radicado_prefix, year)

    async def get(self, ticket_id: uuid.UUID) -> Ticket:
        ticket = await self._tickets.get(ticket_id)
        if ticket is None:
            raise NotFoundError(f"Ticket '{ticket_id}' no existe.")
        return ticket

    async def get_by_radicado(self, radicado: str) -> Ticket:
        ticket = await self._tickets.get_by_radicado(radicado)
        if ticket is None:
            raise NotFoundError(f"No existe un ticket con radicado '{radicado}'.")
        return ticket

    async def list(
        self, filters: TicketFilters, page: int, page_size: int
    ) -> tuple[list[TicketSummary], int]:
        return await self._tickets.list(filters, page, page_size)

    async def update(
        self,
        ticket_id: uuid.UUID,
        *,
        status: TicketStatus | None = None,
        assignee: str | None = None,
        priority: Priority | None = None,
        note: str | None = None,
    ) -> Ticket:
        ticket = await self._tickets.update(
            ticket_id, status=status, assignee=assignee, priority=priority, note=note
        )
        if ticket is None:
            raise NotFoundError(f"Ticket '{ticket_id}' no existe.")
        return ticket

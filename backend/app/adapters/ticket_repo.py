"""Repositorio de tickets sobre PostgreSQL async. Implementa el puerto TicketRepository.

Mapea filas ORM ↔ dataclasses de dominio. Carga de relaciones EXPLÍCITA (selectinload) para evitar
N+1 y el lazy-load implícito (que además rompe en async). La creación es atómica: radicado + ticket +
adjuntos + history en una sola transacción."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.adapters.db_models import (
    AreaRow,
    CategoryRow,
    CounterRow,
    TicketAttachmentRow,
    TicketHistoryRow,
    TicketRow,
)
from app.domain.models import (
    Attachment,
    Contact,
    HistoryActor,
    HistoryEntry,
    Priority,
    Ticket,
    TicketCreateData,
    TicketFilters,
    TicketStatus,
    TicketSummary,
)
from app.services.radicado import format_radicado

# selectinload de todas las relaciones que necesita la vista completa de un ticket.
_FULL = (
    selectinload(TicketRow.category),
    selectinload(TicketRow.area),
    selectinload(TicketRow.attachments),
    selectinload(TicketRow.history),
)


def _to_ticket(row: TicketRow) -> Ticket:
    return Ticket(
        id=row.id,
        radicado=row.radicado,
        status=TicketStatus(row.status),
        category_code=row.category.code,
        category_name=row.category.name,
        area_code=row.area.code,
        area_name=row.area.name,
        priority=Priority(row.priority) if row.priority else None,
        subject=row.subject,
        description=row.description,
        assignee=row.assignee,
        channel=row.channel,
        conversation_id=row.conversation_id,
        contact=Contact(
            wa_id=row.contact_wa_id, name=row.contact_name, document=row.contact_document
        ),
        fields=row.fields or {},
        attachments=[Attachment(url=a.url, mime=a.mime, name=a.name) for a in row.attachments],
        history=[
            HistoryEntry(
                at=h.at,
                status=TicketStatus(h.status),
                actor=HistoryActor(h.actor) if h.actor else None,
                note=h.note,
            )
            for h in row.history
        ],
        created_at=row.created_at,
        updated_at=row.updated_at,
        response_due_at=row.response_due_at,
        resolution_due_at=row.resolution_due_at,
        first_response_at=row.first_response_at,
        resolved_at=row.resolved_at,
    )


def _to_summary(row: TicketRow) -> TicketSummary:
    return TicketSummary(
        id=row.id,
        radicado=row.radicado,
        status=TicketStatus(row.status),
        category_code=row.category.code,
        area_code=row.area.code,
        priority=Priority(row.priority) if row.priority else None,
        subject=row.subject,
        assignee=row.assignee,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class SqlAlchemyTicketRepository:
    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._sf = session_factory

    async def _load(self, session: AsyncSession, ticket_id: uuid.UUID) -> TicketRow | None:
        return (
            await session.execute(
                select(TicketRow).options(*_FULL).where(TicketRow.id == ticket_id)
            )
        ).scalar_one_or_none()

    async def _next_radicado_seq(self, session: AsyncSession, year: int) -> int:
        """Incrementa (atómicamente) el contador anual y devuelve el siguiente número de secuencia.

        `with_for_update` bloquea la fila en Postgres para que dos creaciones concurrentes no colisionen
        el radicado; en SQLite (tests) es no-op y basta la serialización de una sola conexión."""
        name = f"radicado:{year}"
        row = (
            await session.execute(
                select(CounterRow).where(CounterRow.name == name).with_for_update()
            )
        ).scalar_one_or_none()
        if row is None:
            row = CounterRow(name=name, value=1)
            session.add(row)
            await session.flush()
            return 1
        row.value += 1
        await session.flush()
        return row.value

    async def create(self, data: TicketCreateData, radicado_prefix: str, year: int) -> Ticket:
        async with self._sf() as session:
            seq = await self._next_radicado_seq(session, year)
            radicado = format_radicado(radicado_prefix, year, seq)
            row = TicketRow(
                radicado=radicado,
                status=TicketStatus.open.value,
                category_id=data.category_id,
                area_id=data.area_id,
                priority=data.priority.value if data.priority else None,
                subject=data.subject,
                description=data.description,
                assignee=None,
                channel=data.channel,
                conversation_id=data.conversation_id,
                contact_wa_id=data.contact.wa_id,
                contact_name=data.contact.name,
                contact_document=data.contact.document,
                fields=data.fields or {},
                response_due_at=data.response_due_at,
                resolution_due_at=data.resolution_due_at,
            )
            row.attachments = [
                TicketAttachmentRow(url=a.url, mime=a.mime, name=a.name)
                for a in data.attachments
            ]
            row.history = [
                TicketHistoryRow(status=TicketStatus.open.value, actor=data.initial_actor.value)
            ]
            session.add(row)
            await session.commit()
            loaded = await self._load(session, row.id)
            assert loaded is not None  # recién insertado
            return _to_ticket(loaded)

    async def get(self, ticket_id: uuid.UUID) -> Ticket | None:
        async with self._sf() as session:
            row = await self._load(session, ticket_id)
            return _to_ticket(row) if row else None

    async def get_by_radicado(self, radicado: str) -> Ticket | None:
        async with self._sf() as session:
            row = (
                await session.execute(
                    select(TicketRow).options(*_FULL).where(TicketRow.radicado == radicado)
                )
            ).scalar_one_or_none()
            return _to_ticket(row) if row else None

    async def list(
        self, filters: TicketFilters, page: int, page_size: int
    ) -> tuple[list[TicketSummary], int]:
        async with self._sf() as session:
            stmt = select(TicketRow)
            count_stmt = select(func.count()).select_from(TicketRow)
            if filters.category is not None:
                # Filtro por CODE de categoría → join con categories.
                stmt = stmt.join(CategoryRow, TicketRow.category_id == CategoryRow.id)
                count_stmt = count_stmt.join(
                    CategoryRow, TicketRow.category_id == CategoryRow.id
                )
                stmt = stmt.where(CategoryRow.code == filters.category)
                count_stmt = count_stmt.where(CategoryRow.code == filters.category)
            if filters.status is not None:
                stmt = stmt.where(TicketRow.status == filters.status.value)
                count_stmt = count_stmt.where(TicketRow.status == filters.status.value)
            if filters.assignee is not None:
                stmt = stmt.where(TicketRow.assignee == filters.assignee)
                count_stmt = count_stmt.where(TicketRow.assignee == filters.assignee)
            if filters.area_codes is not None:
                # Alcance por área (RBAC del agente): join con areas y filtro por code.
                stmt = stmt.join(AreaRow, TicketRow.area_id == AreaRow.id)
                count_stmt = count_stmt.join(AreaRow, TicketRow.area_id == AreaRow.id)
                stmt = stmt.where(AreaRow.code.in_(filters.area_codes))
                count_stmt = count_stmt.where(AreaRow.code.in_(filters.area_codes))
            if filters.open_only:
                finales = [TicketStatus.closed.value, TicketStatus.rejected.value]
                stmt = stmt.where(TicketRow.status.notin_(finales))
                count_stmt = count_stmt.where(TicketRow.status.notin_(finales))
            if filters.date_from is not None:
                stmt = stmt.where(TicketRow.created_at >= filters.date_from)
                count_stmt = count_stmt.where(TicketRow.created_at >= filters.date_from)
            if filters.date_to is not None:
                stmt = stmt.where(TicketRow.created_at <= filters.date_to)
                count_stmt = count_stmt.where(TicketRow.created_at <= filters.date_to)

            total = (await session.execute(count_stmt)).scalar_one()
            stmt = (
                stmt.options(selectinload(TicketRow.category), selectinload(TicketRow.area))
                .order_by(TicketRow.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [_to_summary(r) for r in rows], total

    async def update(
        self,
        ticket_id: uuid.UUID,
        *,
        status: TicketStatus | None = None,
        assignee: str | None = None,
        priority: Priority | None = None,
        note: str | None = None,
    ) -> Ticket | None:
        async with self._sf() as session:
            row = await self._load(session, ticket_id)
            if row is None:
                return None
            now = datetime.now(timezone.utc)
            status_changed = status is not None and status.value != row.status
            if status is not None:
                row.status = status.value
            if assignee is not None:
                row.assignee = assignee
            if priority is not None:
                row.priority = priority.value
            # SLA: primera respuesta = primera gestión (cambio de estado o asignación).
            if row.first_response_at is None and (status_changed or assignee is not None):
                row.first_response_at = now
            # SLA: resolución = al entrar a un estado final (cerrado/rechazado).
            if (
                row.resolved_at is None
                and status is not None
                and status.value in (TicketStatus.closed.value, TicketStatus.rejected.value)
            ):
                row.resolved_at = now
            # El history registra el cambio de estado (auditoría).
            if status_changed:
                row.history.append(
                    TicketHistoryRow(
                        status=row.status, actor=HistoryActor.human.value, note=note
                    )
                )
            await session.commit()
            reloaded = await self._load(session, ticket_id)
            return _to_ticket(reloaded) if reloaded else None

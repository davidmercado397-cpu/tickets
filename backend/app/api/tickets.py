"""Router de /tickets.

Dos audiencias:
- **Bot** (service-token): `POST /tickets` y `GET /tickets/by-radicado/{radicado}` (crear y consultar).
- **Usuarios humanos** (JWT) o el bot: `GET /tickets`, `GET /{id}`, `PATCH /{id}` — con **alcance por
  área**: un agente solo ve/gestiona tickets de SUS áreas; el service-token y el admin ven todo.

Orden de rutas: `/by-radicado/{radicado}` antes que `/{ticket_id}` (si no, el path param lo captura)."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from app.api.schemas import (
    TicketCreatedOut,
    TicketCreateIn,
    TicketOut,
    TicketPageOut,
    TicketUpdateIn,
    to_created_out,
    to_summary_out,
    to_ticket_out,
)
from app.dependencies import (
    CallerDep,
    NotifierDep,
    TicketServiceDep,
    UserEventNotifierDep,
    require_service_token,
)
from app.domain.models import Attachment, Caller, Contact, Ticket, TicketFilters, TicketStatus

router = APIRouter(prefix="/tickets", tags=["tickets"])

_NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado.")


def _assert_in_scope(caller: Caller, ticket: Ticket) -> None:
    """Un agente solo puede ver/tocar tickets de sus áreas. 404 (no 403) para no filtrar existencia."""
    scope = caller.scoped_area_codes
    if scope is not None and ticket.area_code not in scope:
        raise _NOT_FOUND


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Crear un ticket (bot)",
    dependencies=[Depends(require_service_token)],
)
async def create_ticket(
    body: TicketCreateIn,
    service: TicketServiceDep,
    notifier: NotifierDep,
    background: BackgroundTasks,
) -> TicketCreatedOut:
    ticket = await service.create(
        category_code=body.category,
        contact=Contact(
            wa_id=body.contact.wa_id, name=body.contact.name, document=body.contact.document
        ),
        area_hint=body.area,
        priority=body.priority,
        subject=body.subject,
        description=body.description,
        channel=body.channel,
        conversation_id=body.conversation_id,
        fields=body.fields,
        attachments=[
            Attachment(url=a.url, mime=a.mime, name=a.name) for a in body.attachments
        ],
    )
    # Avisa al grupo del área (in-app síncrono; WhatsApp/email en background).
    await notifier.notify_ticket_created(ticket, background)
    return to_created_out(ticket)


@router.get("", summary="Listar tickets (alcance por área para agentes)")
async def list_tickets(
    service: TicketServiceDep,
    caller: CallerDep,
    status_: TicketStatus | None = Query(default=None, alias="status"),
    category: str | None = Query(default=None),
    assignee: str | None = Query(default=None),
    open_only: bool = Query(default=False, description="Solo tickets no cerrados/rechazados (cola)."),
    date_from: datetime | None = Query(default=None, alias="from"),
    date_to: datetime | None = Query(default=None, alias="to"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> TicketPageOut:
    filters = TicketFilters(
        status=status_,
        category=category,
        assignee=assignee,
        date_from=date_from,
        date_to=date_to,
        open_only=open_only,
        area_codes=caller.scoped_area_codes,  # None = ve todo; agente = solo sus áreas
    )
    items, total = await service.list(filters, page, page_size)
    return TicketPageOut(
        items=[to_summary_out(s) for s in items], total=total, page=page, page_size=page_size
    )


@router.get(
    "/by-radicado/{radicado}",
    summary="Consultar estado por radicado (bot)",
    dependencies=[Depends(require_service_token)],
)
async def get_ticket_by_radicado(radicado: str, service: TicketServiceDep) -> TicketOut:
    return to_ticket_out(await service.get_by_radicado(radicado))


@router.get("/{ticket_id}", summary="Obtener un ticket por id")
async def get_ticket(
    ticket_id: uuid.UUID, service: TicketServiceDep, caller: CallerDep
) -> TicketOut:
    ticket = await service.get(ticket_id)
    _assert_in_scope(caller, ticket)
    return to_ticket_out(ticket)


@router.patch("/{ticket_id}", summary="Actualizar estado/asignación/prioridad/nota")
async def update_ticket(
    ticket_id: uuid.UUID,
    body: TicketUpdateIn,
    service: TicketServiceDep,
    caller: CallerDep,
    notifier: NotifierDep,
    user_events: UserEventNotifierDep,
    background: BackgroundTasks,
) -> TicketOut:
    # Verifica el alcance ANTES de mutar (un agente no toca tickets fuera de sus áreas).
    existing = await service.get(ticket_id)
    _assert_in_scope(caller, existing)
    ticket = await service.update(
        ticket_id,
        status=body.status,
        assignee=body.assignee,
        priority=body.priority,
        note=body.note,
    )
    # Si se asignó a alguien, avísale (interno). Si el estado cambió a uno que dispara aviso al
    # solicitante, evento de vuelta por WhatsApp (best-effort).
    if body.assignee is not None:
        await notifier.notify_ticket_assigned(ticket, background)
    user_events.notify_status_change(ticket, existing.status, background)
    return to_ticket_out(ticket)

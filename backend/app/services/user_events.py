"""Evento de vuelta al usuario final (B3): avisar al solicitante por WhatsApp cuando su ticket cambia.

Frontera: el envío lo hace el Gateway (`POST /send` con plantilla aprobada, fuera de la ventana de 24h);
nosotros solo lo disparamos. Best-effort en background: si falla, se loguea y no rompe el PATCH."""

from __future__ import annotations

import logging

from fastapi import BackgroundTasks

from app.domain.models import Ticket, TicketStatus
from app.domain.ports import GatewayClient

logger = logging.getLogger(__name__)


class UserEventNotifier:
    def __init__(
        self,
        gateway: GatewayClient | None,
        template: str,
        language: str,
        trigger_statuses: set[str],
    ) -> None:
        self._gateway = gateway
        self._template = template
        self._language = language
        self._statuses = trigger_statuses

    def notify_status_change(
        self, ticket: Ticket, old_status: TicketStatus, background: BackgroundTasks
    ) -> None:
        """Encola el aviso si el estado cambió a uno que dispara notificación y WhatsApp está configurado."""
        if self._gateway is None:  # canal no configurado → se omite limpio
            return
        if ticket.status == old_status or ticket.status.value not in self._statuses:
            return
        if not ticket.contact.wa_id:
            return
        background.add_task(self._safe_send, ticket)

    async def _safe_send(self, ticket: Ticket) -> None:
        try:
            await self._gateway.send_template(
                to=ticket.contact.wa_id,
                template=self._template,
                language=self._language,
                body_params=[ticket.radicado, ticket.status.value],
            )
        except Exception:  # noqa: BLE001 — best-effort, nunca rompe la operación
            logger.warning("Falló el evento de vuelta al usuario", exc_info=True)

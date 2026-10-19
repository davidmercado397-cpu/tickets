"""Servicio de notificaciones + canales externos (Strategy).

Flujo: al crear/asignar un ticket, se resuelven los destinatarios (usuarios del área, o el asignado) y
se entrega por:
- **in-app** (SIEMPRE, núcleo): persiste en `notifications` + publica al bus (SSE). Síncrono y confiable.
- **canales externos** (WhatsApp, email): best-effort en background (no bloquean ni tumban la operación).

Añadir un canal externo = una clase que cumpla `NotificationChannel` (Open/Closed)."""

from __future__ import annotations

import logging

from fastapi import BackgroundTasks

from app.domain.models import Notification, NotificationType, Ticket, User
from app.domain.ports import (
    EmailSender,
    GatewayClient,
    NotificationBus,
    NotificationChannel,
    NotificationRepository,
    UserRepository,
)

logger = logging.getLogger(__name__)


# --- Canales externos (Strategy) ---


class WhatsAppChannel:
    """Envía la notificación por WhatsApp (plantilla) vía el Gateway. Requiere `phone` del usuario."""

    name = "whatsapp"

    def __init__(self, gateway: GatewayClient, template: str, language: str) -> None:
        self._gateway = gateway
        self._template = template
        self._language = language

    def applies(self, user: User) -> bool:
        return bool(user.phone)

    async def send(self, notification: Notification, user: User) -> None:
        assert user.phone is not None  # applies() lo garantiza
        await self._gateway.send_template(
            to=user.phone,
            template=self._template,
            language=self._language,
            body_params=[notification.radicado or "-", notification.title],
        )


class EmailChannel:
    """Envía la notificación por email."""

    name = "email"

    def __init__(self, sender: EmailSender) -> None:
        self._sender = sender

    def applies(self, user: User) -> bool:
        return bool(user.email)

    async def send(self, notification: Notification, user: User) -> None:
        await self._sender.send(
            to=user.email,
            subject=notification.title,
            body=notification.body or notification.title,
        )


# --- Servicio ---


class NotificationService:
    def __init__(
        self,
        users: UserRepository,
        notifications: NotificationRepository,
        bus: NotificationBus,
        external_channels: list[NotificationChannel],
    ) -> None:
        self._users = users
        self._notifications = notifications
        self._bus = bus
        self._external = external_channels

    async def _deliver_inapp(
        self, user: User, type: NotificationType, title: str, body: str | None, ticket: Ticket
    ) -> Notification:
        notif = await self._notifications.create(
            user_id=user.id,
            type=type,
            title=title,
            body=body,
            ticket_id=ticket.id,
            radicado=ticket.radicado,
        )
        # Push en tiempo real (SSE). Efímero: si nadie escucha, se pierde (la verdad está en BD).
        try:
            await self._bus.publish(user.id, notif)
        except Exception:  # noqa: BLE001 — el bus nunca debe romper la operación
            logger.warning("No se pudo publicar la notificación al bus", exc_info=True)
        return notif

    def _schedule_external(
        self, notif: Notification, user: User, background: BackgroundTasks
    ) -> None:
        for channel in self._external:
            if channel.applies(user):
                background.add_task(self._safe_send, channel, notif, user)

    async def _safe_send(
        self, channel: NotificationChannel, notif: Notification, user: User
    ) -> None:
        """Best-effort: un canal externo que falla se loguea, no rompe nada ni afecta a los demás."""
        try:
            await channel.send(notif, user)
        except Exception:  # noqa: BLE001
            logger.warning(
                "Falló el canal de notificación '%s'", channel.name, exc_info=True
            )

    async def notify_ticket_created(self, ticket: Ticket, background: BackgroundTasks) -> None:
        """Avisa al GRUPO del área del ticket recién creado."""
        recipients = await self._users.list_by_area_code(ticket.area_code)
        area = ticket.area_name or ticket.area_code
        category = ticket.category_name or ticket.category_code
        title = f"Nuevo caso en {area}"
        body = f"{ticket.radicado} · {category}" + (f": {ticket.subject}" if ticket.subject else "")
        for user in recipients:
            notif = await self._deliver_inapp(
                user, NotificationType.ticket_created, title, body, ticket
            )
            self._schedule_external(notif, user, background)

    async def notify_ticket_assigned(self, ticket: Ticket, background: BackgroundTasks) -> None:
        """Avisa a la persona asignada (si `assignee` es el email de un usuario conocido y activo)."""
        if not ticket.assignee:
            return
        user = await self._users.get_by_email(ticket.assignee)
        if user is None or not user.active:
            return  # assignee no corresponde a un usuario → no hay a quién notificar
        area = ticket.area_name or ticket.area_code
        title = "Te asignaron un caso"
        body = f"{ticket.radicado} en {area}"
        notif = await self._deliver_inapp(
            user, NotificationType.ticket_assigned, title, body, ticket
        )
        self._schedule_external(notif, user, background)

"""Puertos del dominio (Ports & Adapters lite con typing.Protocol).

Definen las interfaces de acceso a datos en términos de dataclasses de dominio (no filas ORM). Los
adaptadores concretos viven en `app/adapters/` y son intercambiables/testeables con fakes. El dominio
NO importa SQLAlchemy: solo declara qué necesita, no cómo se implementa."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Protocol

from app.domain.models import (
    Area,
    Category,
    Employee,
    Notification,
    NotificationType,
    Priority,
    Role,
    SlaPolicy,
    Ticket,
    TicketCreateData,
    TicketFilters,
    TicketStatus,
    TicketSummary,
    User,
)


class AreaRepository(Protocol):
    async def list(self, only_active: bool = False) -> list[Area]: ...
    async def get(self, area_id: uuid.UUID) -> Area | None: ...
    async def get_by_code(self, code: str) -> Area | None: ...
    async def create(self, code: str, name: str) -> Area: ...
    async def update(
        self, area_id: uuid.UUID, name: str | None = None, active: bool | None = None
    ) -> Area | None: ...


class CategoryRepository(Protocol):
    async def list(self, only_active: bool = False) -> list[Category]: ...
    async def get(self, category_id: uuid.UUID) -> Category | None: ...
    async def get_by_code(self, code: str) -> Category | None: ...
    async def create(self, code: str, name: str, area_id: uuid.UUID) -> Category: ...
    async def update(
        self, category_id: uuid.UUID, name: str | None = None, active: bool | None = None
    ) -> Category | None: ...


class TicketRepository(Protocol):
    async def create(self, data: TicketCreateData, radicado_prefix: str, year: int) -> Ticket:
        """Crea el ticket de forma ATÓMICA: asigna radicado (secuencia del `year` indicado), inserta
        ticket + adjuntos + entrada de history inicial, todo en una transacción."""
        ...

    async def get(self, ticket_id: uuid.UUID) -> Ticket | None: ...
    async def get_by_radicado(self, radicado: str) -> Ticket | None: ...
    async def list(
        self, filters: TicketFilters, page: int, page_size: int
    ) -> tuple[list[TicketSummary], int]:
        """Devuelve (página de resúmenes, total)."""
        ...

    async def update(
        self,
        ticket_id: uuid.UUID,
        *,
        status: TicketStatus | None = None,
        assignee: str | None = None,
        priority: Priority | None = None,
        note: str | None = None,
    ) -> Ticket | None:
        """Actualiza campos; si cambia el status, añade una entrada de history."""
        ...


class UserRepository(Protocol):
    async def create(
        self,
        *,
        email: str,
        password_hash: str,
        salt: str,
        display_name: str | None,
        phone: str | None,
        role: Role,
        area_ids: list[uuid.UUID],
    ) -> User: ...
    async def get(self, user_id: uuid.UUID) -> User | None: ...
    async def get_by_email(self, email: str) -> User | None: ...
    async def list(self) -> list[User]: ...
    async def list_by_area_code(self, area_code: str) -> list[User]:
        """Usuarios (activos) que pertenecen al área — destinatarios de la notificación al grupo."""
        ...
    async def get_auth_by_email(self, email: str) -> tuple[User, str, str] | None:
        """Devuelve (user, salt, password_hash) para verificar la contraseña, o None. El hash/salt
        NUNCA salen del servicio de auth."""
        ...

    async def update(
        self,
        user_id: uuid.UUID,
        *,
        display_name: str | None = None,
        phone: str | None = None,
        role: Role | None = None,
        active: bool | None = None,
        password_hash: str | None = None,
        salt: str | None = None,
    ) -> User | None:
        """Actualiza los campos no-None. Devuelve el usuario actualizado, o None si no existe."""
        ...

    async def set_areas(self, user_id: uuid.UUID, area_ids: list[uuid.UUID]) -> None:
        """Reemplaza la membresía de áreas del usuario por `area_ids`."""
        ...


class NotificationRepository(Protocol):
    async def create(
        self,
        *,
        user_id: uuid.UUID,
        type: NotificationType,
        title: str,
        body: str | None,
        ticket_id: uuid.UUID | None,
        radicado: str | None,
    ) -> Notification: ...
    async def list_for_user(
        self, user_id: uuid.UUID, *, unread_only: bool = False, limit: int = 50
    ) -> list[Notification]: ...
    async def unread_count(self, user_id: uuid.UUID) -> int: ...
    async def mark_read(self, user_id: uuid.UUID, notification_id: uuid.UUID) -> bool:
        """True si marcó una; False si no existe o no es de ese usuario."""
        ...
    async def mark_all_read(self, user_id: uuid.UUID) -> int: ...


class NotificationBus(Protocol):
    """Bus pub/sub para el push en tiempo real (SSE). Aislado por usuario."""

    async def publish(self, user_id: uuid.UUID, notification: Notification) -> None: ...
    def subscribe(self, user_id: uuid.UUID): ...  # async iterator de payloads (dict)


class GatewayClient(Protocol):
    """Cliente del WhatsApp Gateway (POST /send). Lo usa el canal WhatsApp."""

    async def send_template(
        self, *, to: str, template: str, language: str, body_params: list[str]
    ) -> None: ...


class EmailSender(Protocol):
    async def send(self, *, to: str, subject: str, body: str) -> None: ...


class NotificationChannel(Protocol):
    """Canal externo de entrega (Strategy). Añadir un canal = una implementación nueva (Open/Closed)."""

    name: str

    def applies(self, user: User) -> bool:
        """True si este canal puede entregar a ese usuario (p.ej. WhatsApp requiere `phone`)."""
        ...

    async def send(self, notification: Notification, user: User) -> None: ...


class ObjectStorage(Protocol):
    """Almacenamiento de objetos (R2/S3). Guarda el PDF generado y firma una URL temporal."""

    async def put(self, key: str, data: bytes, content_type: str) -> None: ...
    async def signed_url(self, key: str, ttl_seconds: int) -> str: ...


class SlaPolicyRepository(Protocol):
    async def list(self) -> list[SlaPolicy]: ...
    async def get(self, priority: Priority) -> SlaPolicy | None: ...
    async def upsert(
        self, priority: Priority, response_minutes: int, resolution_minutes: int
    ) -> SlaPolicy: ...


class EmployeeDirectory(Protocol):
    """Directorio de empleados. Hoy: tabla propia. Mañana: podría proxear el ERP (el `get_by_document`
    es lo que los flujos del bot consumen y lo que se intercambiaría)."""

    async def get_by_document(self, document: str) -> Employee | None: ...
    async def list(
        self, *, q: str | None, page: int, page_size: int
    ) -> tuple[list[Employee], int]: ...
    async def create(
        self,
        *,
        document: str,
        full_name: str,
        position: str | None,
        hire_date: date | None,
        contract_type: str | None,
        status: str | None,
        data: dict,
    ) -> Employee: ...
    async def update(
        self,
        document: str,
        *,
        full_name: str | None = None,
        position: str | None = None,
        hire_date: date | None = None,
        contract_type: str | None = None,
        status: str | None = None,
        data: dict | None = None,
    ) -> Employee | None: ...

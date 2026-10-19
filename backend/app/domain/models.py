"""Modelos de dominio (puros): enums + dataclasses. No conocen FastAPI ni SQLAlchemy.

Son la "moneda" entre servicios y puertos. Los adaptadores (repos) mapean filas ORM ↔ estas
dataclasses; la capa API mapea estas dataclasses ↔ schemas Pydantic. Así el dominio queda aislado."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum


class TicketStatus(str, Enum):
    """Estados del ciclo de vida del ticket (codes en inglés; labels español los pone el frontend).

    Mapeo a labels: open→Abierto, in_review→En revisión, assigned→Asignado, in_progress→En gestión,
    on_hold→En espera, closed→Cerrado, rejected→Rechazado."""

    open = "open"
    in_review = "in_review"
    assigned = "assigned"
    in_progress = "in_progress"
    on_hold = "on_hold"
    closed = "closed"
    rejected = "rejected"


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class HistoryActor(str, Enum):
    user = "user"
    ai = "ai"
    human = "human"
    system = "system"


class Role(str, Enum):
    """Roles de usuario humano (RBAC). Mínimo por ahora (YAGNI): admin gestiona; agent atiende."""

    admin = "admin"
    agent = "agent"


class NotificationType(str, Enum):
    """Motivo de la notificación interna."""

    ticket_created = "ticket_created"  # entró un ticket al área → avisa al grupo
    ticket_assigned = "ticket_assigned"  # te asignaron un ticket → avisa a esa persona


@dataclass(frozen=True)
class Principal:
    """Identidad del bot (service-token). Para usuarios humanos ver `UserContext`."""

    kind: str  # "service"
    label: str


@dataclass
class User:
    """Usuario humano (agente/admin). `area_codes`: áreas a las que pertenece (membresía)."""

    id: uuid.UUID
    email: str
    role: Role
    active: bool
    created_at: datetime
    updated_at: datetime
    display_name: str | None = None
    phone: str | None = None  # wa_id para notificar por WhatsApp (opcional)
    area_codes: list[str] = field(default_factory=list)


@dataclass
class Employee:
    """Empleado (base para autoservicio laboral: certificados, incapacidades).

    Hoy vive en tabla propia; el puerto `EmployeeDirectory` permite proxear el ERP a futuro. `data`
    guarda campos autorizados adicionales (p.ej. prórrogas) sin cambiar el esquema (config-as-data)."""

    document: str  # cédula/identificación (clave pública de consulta)
    full_name: str
    position: str | None = None
    hire_date: date | None = None
    contract_type: str | None = None
    status: str | None = None  # laboral: activo|retirado|...
    data: dict = field(default_factory=dict)


@dataclass
class CertificateResult:
    """Resultado de emitir un certificado: URL temporal del PDF + el ticket de auditoría creado."""

    url: str
    expires_at: datetime
    ticket: "Ticket"


@dataclass
class Notification:
    """Notificación interna (in-app) para un usuario."""

    id: uuid.UUID
    user_id: uuid.UUID
    type: NotificationType
    title: str
    created_at: datetime
    read: bool = False
    body: str | None = None
    ticket_id: uuid.UUID | None = None
    radicado: str | None = None


@dataclass(frozen=True)
class UserContext:
    """Identidad autenticada de un usuario humano (resuelta del JWT + BD en cada request)."""

    user_id: uuid.UUID
    email: str
    role: Role
    display_name: str | None = None
    area_codes: tuple[str, ...] = ()


@dataclass(frozen=True)
class Caller:
    """Quien llama a la API: el bot (service-token, acceso total) o un usuario humano (RBAC)."""

    kind: str  # "service" | "user"
    user: UserContext | None = None

    @property
    def sees_all_areas(self) -> bool:
        """True si ve todas las áreas: el service-token (integración confiable) o un admin."""
        return self.kind == "service" or (self.user is not None and self.user.role == Role.admin)

    @property
    def scoped_area_codes(self) -> tuple[str, ...] | None:
        """Áreas a las que está limitado. None = sin límite (ve todo); un agente ve solo las suyas."""
        if self.sees_all_areas:
            return None
        return self.user.area_codes if self.user else ()


@dataclass
class Contact:
    """Contacto del solicitante (viene del chat de WhatsApp del Gateway)."""

    wa_id: str
    name: str | None = None
    document: str | None = None


@dataclass
class Attachment:
    """Adjunto referenciado por URL pública (R2 del Gateway). NO se descarga ni copia (inc 1)."""

    url: str
    mime: str | None = None
    name: str | None = None


@dataclass
class HistoryEntry:
    at: datetime
    status: TicketStatus
    actor: HistoryActor | None = None
    note: str | None = None


@dataclass
class Area:
    """Área/departamento responsable. Catálogo de referencia (config-as-data)."""

    id: uuid.UUID
    code: str
    name: str
    active: bool


@dataclass
class Category:
    """Categoría (subtipo de solicitud) que PERTENECE a un área (1—*). Su `code` ubica el área."""

    id: uuid.UUID
    code: str
    name: str
    active: bool
    area_id: uuid.UUID
    area_code: str | None = None  # conveniencia para no re-consultar el área


@dataclass
class SlaPolicy:
    """Política de SLA por prioridad (config-as-data). Minutos calendario (24/7)."""

    priority: Priority
    response_minutes: int
    resolution_minutes: int


@dataclass
class Ticket:
    id: uuid.UUID
    radicado: str
    status: TicketStatus
    category_code: str
    area_code: str
    contact: Contact
    created_at: datetime
    updated_at: datetime
    # SLA (calculado al crear; los *_at reales se marcan en las transiciones).
    response_due_at: datetime | None = None
    resolution_due_at: datetime | None = None
    first_response_at: datetime | None = None
    resolved_at: datetime | None = None
    category_name: str | None = None
    area_name: str | None = None
    priority: Priority | None = None
    subject: str | None = None
    description: str | None = None
    assignee: str | None = None
    channel: str | None = None
    conversation_id: str | None = None
    fields: dict = field(default_factory=dict)
    attachments: list[Attachment] = field(default_factory=list)
    history: list[HistoryEntry] = field(default_factory=list)


@dataclass
class TicketSummary:
    """Vista ligera para listados (sin history/attachments/fields, para evitar N+1 y payload gordo)."""

    id: uuid.UUID
    radicado: str
    status: TicketStatus
    category_code: str
    area_code: str
    created_at: datetime
    updated_at: datetime
    priority: Priority | None = None
    subject: str | None = None
    assignee: str | None = None


@dataclass
class TicketCreateData:
    """Datos ya validados para crear un ticket (el service resolvió categoría→área)."""

    category_id: uuid.UUID
    area_id: uuid.UUID
    contact: Contact
    priority: Priority | None = None
    subject: str | None = None
    description: str | None = None
    channel: str | None = None
    conversation_id: str | None = None
    fields: dict = field(default_factory=dict)
    attachments: list[Attachment] = field(default_factory=list)
    initial_actor: HistoryActor = HistoryActor.system
    response_due_at: datetime | None = None
    resolution_due_at: datetime | None = None


@dataclass
class TicketFilters:
    """Filtros de listado (todos opcionales)."""

    status: TicketStatus | None = None
    category: str | None = None  # code
    assignee: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    # Restringe a estas áreas (por code). None = sin restricción; () = ninguna (agente sin áreas).
    area_codes: tuple[str, ...] | None = None
    # "Cola": excluye estados finales (cerrado/rechazado).
    open_only: bool = False

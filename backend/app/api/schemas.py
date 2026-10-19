"""Schemas Pydantic v2 (request/response) — calcan el contrato OpenAPI + extensiones (áreas/categorías).

Aquí vive el "borde": mapea dataclasses de dominio ↔ modelos de API. Los enums se reusan del dominio.
Las respuestas NUNCA exponen secretos ni ids internos como referencia de integración (el `code` es la
referencia pública; el `id` se expone solo informativo en los catálogos)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from pydantic import BaseModel, Field

from app.domain.models import (
    Area,
    Category,
    Employee,
    Notification,
    Priority,
    Role,
    SlaPolicy,
    Ticket,
    TicketStatus,
    TicketSummary,
    User,
)

# ---------------------------------------------------------------------------
# Tickets — entrada
# ---------------------------------------------------------------------------


class ContactIn(BaseModel):
    wa_id: str
    name: str | None = None
    document: str | None = None


class AttachmentIn(BaseModel):
    url: str
    mime: str | None = None
    name: str | None = None


class TicketCreateIn(BaseModel):
    contact: ContactIn
    category: str = Field(description="Code de la categoría (requerida). Determina el área.")
    area: str | None = Field(
        default=None,
        description="Code de área (hint opcional de cross-check). En mismatch se usa el de la categoría.",
    )
    channel: str = "whatsapp"
    conversation_id: str | None = None
    priority: Priority | None = None
    subject: str | None = None
    description: str | None = None
    fields: dict = Field(default_factory=dict)
    attachments: list[AttachmentIn] = Field(default_factory=list)


class TicketUpdateIn(BaseModel):
    status: TicketStatus | None = None
    assignee: str | None = None
    priority: Priority | None = None
    note: str | None = None


# ---------------------------------------------------------------------------
# Tickets — salida
# ---------------------------------------------------------------------------


class ContactOut(BaseModel):
    wa_id: str
    name: str | None = None
    document: str | None = None


class AttachmentOut(BaseModel):
    url: str
    mime: str | None = None
    name: str | None = None


class HistoryOut(BaseModel):
    at: datetime
    status: TicketStatus
    actor: str | None = None
    note: str | None = None


class SlaOut(BaseModel):
    response_due_at: datetime | None = None
    resolution_due_at: datetime | None = None
    first_response_at: datetime | None = None
    resolved_at: datetime | None = None
    response_breached: bool = False
    resolution_breached: bool = False


class SlaPolicyOut(BaseModel):
    priority: Priority
    response_minutes: int
    resolution_minutes: int


class SlaPolicyUpsertIn(BaseModel):
    response_minutes: int = Field(gt=0)
    resolution_minutes: int = Field(gt=0)


class TicketCreatedOut(BaseModel):
    ticket_id: str
    radicado: str
    status: TicketStatus
    created_at: datetime


class TicketOut(BaseModel):
    ticket_id: str
    radicado: str
    status: TicketStatus
    category: str  # code
    category_name: str | None = None
    area: str  # code
    area_name: str | None = None
    priority: Priority | None = None
    subject: str | None = None
    description: str | None = None
    assignee: str | None = None
    conversation_id: str | None = None
    contact: ContactOut
    fields: dict = Field(default_factory=dict)
    attachments: list[AttachmentOut] = Field(default_factory=list)
    history: list[HistoryOut] = Field(default_factory=list)
    sla: SlaOut
    created_at: datetime
    updated_at: datetime


class TicketSummaryOut(BaseModel):
    ticket_id: str
    radicado: str
    status: TicketStatus
    category: str
    area: str
    priority: Priority | None = None
    subject: str | None = None
    assignee: str | None = None
    created_at: datetime
    updated_at: datetime


class TicketPageOut(BaseModel):
    items: list[TicketSummaryOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Catálogos (áreas / categorías)
# ---------------------------------------------------------------------------


class AreaOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    active: bool


class AreaCreateIn(BaseModel):
    name: str
    code: str | None = Field(default=None, description="Opcional; por defecto slugify(name).")


class AreaUpdateIn(BaseModel):
    name: str | None = None
    active: bool | None = None
    # Se acepta para rechazarlo con 422 explícito: el code es inmutable tras crear.
    code: str | None = None


class CategoryOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    active: bool
    area: str  # code del área a la que pertenece (extensión útil para el front)


class CategoryCreateIn(BaseModel):
    name: str
    area: str = Field(description="Code del área a la que pertenece la categoría.")
    code: str | None = Field(default=None, description="Opcional; por defecto slugify(name).")


class CategoryUpdateIn(BaseModel):
    name: str | None = None
    active: bool | None = None
    code: str | None = None  # se rechaza con 422 (inmutable)


# ---------------------------------------------------------------------------
# Auth / usuarios
# ---------------------------------------------------------------------------


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class MeOut(BaseModel):
    user_id: str
    email: str
    display_name: str | None = None
    role: Role


class UserCreateIn(BaseModel):
    email: str
    password: str
    role: Role
    display_name: str | None = None
    phone: str | None = Field(default=None, description="wa_id para notificar por WhatsApp.")
    area_codes: list[str] = Field(default_factory=list)


class UserUpdateIn(BaseModel):
    """PATCH: cada campo omitido/None se deja igual. `area_codes` reemplaza la membresía completa."""

    display_name: str | None = None
    phone: str | None = None
    role: Role | None = None
    active: bool | None = None
    area_codes: list[str] | None = None
    password: str | None = None


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str | None = None
    phone: str | None = None
    role: Role
    active: bool
    area_codes: list[str] = Field(default_factory=list)


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    body: str | None = None
    ticket_id: uuid.UUID | None = None
    radicado: str | None = None
    read: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Empleados
# ---------------------------------------------------------------------------


class EmployeeOut(BaseModel):
    document: str
    full_name: str
    position: str | None = None
    hire_date: date | None = None
    contract_type: str | None = None
    status: str | None = None
    data: dict = Field(default_factory=dict)


class EmployeeCreateIn(BaseModel):
    document: str
    full_name: str
    position: str | None = None
    hire_date: date | None = None
    contract_type: str | None = None
    status: str | None = None
    data: dict = Field(default_factory=dict)


class EmployeeUpdateIn(BaseModel):
    """PATCH: cada campo omitido/None se deja igual. El `document` no se edita (es la clave)."""

    full_name: str | None = None
    position: str | None = None
    hire_date: date | None = None
    contract_type: str | None = None
    status: str | None = None
    data: dict | None = None


class EmployeePageOut(BaseModel):
    items: list[EmployeeOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Certificado laboral
# ---------------------------------------------------------------------------


class CertificateRequestIn(BaseModel):
    contact: ContactIn
    conversation_id: str | None = None


class CertificateOut(BaseModel):
    url: str
    expires_at: datetime
    ticket_id: str
    radicado: str
    status: TicketStatus


# ---------------------------------------------------------------------------
# Mappers dominio -> salida
# ---------------------------------------------------------------------------


def to_user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        email=u.email,
        display_name=u.display_name,
        phone=u.phone,
        role=u.role,
        active=u.active,
        area_codes=u.area_codes,
    )


def to_employee_out(e: Employee) -> EmployeeOut:
    return EmployeeOut(
        document=e.document,
        full_name=e.full_name,
        position=e.position,
        hire_date=e.hire_date,
        contract_type=e.contract_type,
        status=e.status,
        data=e.data,
    )


def to_notification_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=n.id,
        type=n.type.value,
        title=n.title,
        body=n.body,
        ticket_id=n.ticket_id,
        radicado=n.radicado,
        read=n.read,
        created_at=n.created_at,
    )


def to_area_out(area: Area) -> AreaOut:
    return AreaOut(id=area.id, code=area.code, name=area.name, active=area.active)


def to_category_out(category: Category) -> CategoryOut:
    return CategoryOut(
        id=category.id,
        code=category.code,
        name=category.name,
        active=category.active,
        area=category.area_code or "",
    )


def _as_naive_utc(dt: datetime | None) -> datetime | None:
    """Normaliza a naive-UTC para comparar (SQLite devuelve naive; Postgres aware; siempre guardamos UTC)."""
    if dt is None:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def _to_sla_out(t: Ticket) -> SlaOut:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    resp_due = _as_naive_utc(t.response_due_at)
    reso_due = _as_naive_utc(t.resolution_due_at)
    first = _as_naive_utc(t.first_response_at)
    resolved = _as_naive_utc(t.resolved_at)
    return SlaOut(
        response_due_at=t.response_due_at,
        resolution_due_at=t.resolution_due_at,
        first_response_at=t.first_response_at,
        resolved_at=t.resolved_at,
        # Vencido si la marca real (o ahora, si aún no ocurre) supera el vencimiento.
        response_breached=resp_due is not None and (first or now) > resp_due,
        resolution_breached=reso_due is not None and (resolved or now) > reso_due,
    )


def to_sla_policy_out(p: "SlaPolicy") -> SlaPolicyOut:
    return SlaPolicyOut(
        priority=p.priority,
        response_minutes=p.response_minutes,
        resolution_minutes=p.resolution_minutes,
    )


def to_ticket_out(t: Ticket) -> TicketOut:
    return TicketOut(
        ticket_id=str(t.id),
        radicado=t.radicado,
        status=t.status,
        category=t.category_code,
        category_name=t.category_name,
        area=t.area_code,
        area_name=t.area_name,
        priority=t.priority,
        subject=t.subject,
        description=t.description,
        assignee=t.assignee,
        conversation_id=t.conversation_id,
        contact=ContactOut(
            wa_id=t.contact.wa_id, name=t.contact.name, document=t.contact.document
        ),
        fields=t.fields,
        attachments=[AttachmentOut(url=a.url, mime=a.mime, name=a.name) for a in t.attachments],
        history=[
            HistoryOut(
                at=h.at,
                status=h.status,
                actor=h.actor.value if h.actor else None,
                note=h.note,
            )
            for h in t.history
        ],
        sla=_to_sla_out(t),
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def to_created_out(t: Ticket) -> TicketCreatedOut:
    return TicketCreatedOut(
        ticket_id=str(t.id), radicado=t.radicado, status=t.status, created_at=t.created_at
    )


def to_summary_out(s: TicketSummary) -> TicketSummaryOut:
    return TicketSummaryOut(
        ticket_id=str(s.id),
        radicado=s.radicado,
        status=s.status,
        category=s.category_code,
        area=s.area_code,
        priority=s.priority,
        subject=s.subject,
        assignee=s.assignee,
        created_at=s.created_at,
        updated_at=s.updated_at,
    )

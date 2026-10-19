from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

Segment = Literal["external", "internal"]
Priority = Literal["urgent", "high", "medium", "low"]
Status = Literal["received", "assigned", "in_progress", "on_hold", "pending_approval", "responded", "cancelled"]
Channel = Literal["web", "manual", "email", "whatsapp", "integration"]
SlaState = Literal["on_time", "at_risk", "overdue", "met", "missed"]
DocType = Literal["CC", "CE", "TI", "PA", "PPT", "NIT"]


class RequesterIn(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    doc_type: DocType | None = None
    document: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    company: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=250)


class PqrsCreate(BaseModel):
    """Radicación (manual, integración). El portal usa `PublicPqrsCreate`."""

    segment: Segment
    request_type_id: uuid.UUID
    category_id: uuid.UUID | None = None
    subcategory_id: uuid.UUID | None = None
    area_id: uuid.UUID | None = None
    priority: Priority | None = None
    subject: str = Field(min_length=3, max_length=250)
    description: str = Field(min_length=5, max_length=20000)
    is_anonymous: bool = False
    client_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    employee_id: uuid.UUID | None = None
    requester: RequesterIn = RequesterIn()
    channel: Channel = "manual"
    assignee_id: uuid.UUID | None = None
    external_ref: str | None = Field(default=None, max_length=250)
    consent: bool = True


class PublicPqrsCreate(BaseModel):
    segment: Segment
    request_type_id: uuid.UUID
    category_id: uuid.UUID | None = None
    subcategory_id: uuid.UUID | None = None
    subject: str = Field(min_length=3, max_length=250)
    description: str = Field(min_length=10, max_length=20000)
    is_anonymous: bool = False
    client_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    requester: RequesterIn = RequesterIn()
    consent: bool
    website: str | None = None  # honeypot anti-bots: debe llegar vacío

    @model_validator(mode="after")
    def _check(self) -> "PublicPqrsCreate":
        if not self.consent:
            raise ValueError("Debes autorizar el tratamiento de datos personales.")
        if not self.is_anonymous:
            r = self.requester
            if not (r.name and r.email):
                raise ValueError("Nombre y correo son obligatorios (o marca la solicitud como anónima).")
            if self.segment == "internal" and not r.document:
                raise ValueError("El documento es obligatorio para empleados.")
        return self


class PublicCreated(BaseModel):
    radicado: str
    public_code: str
    sla_due_at: datetime | None


class ClassifyIn(BaseModel):
    request_type_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    subcategory_id: uuid.UUID | None = None
    area_id: uuid.UUID | None = None
    priority: Priority | None = None
    client_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    employee_id: uuid.UUID | None = None
    note: str | None = None


class AssignIn(BaseModel):
    assignee_id: uuid.UUID | None
    note: str | None = None


class StatusIn(BaseModel):
    status: Literal["in_progress", "on_hold", "cancelled", "received"]
    note: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def _note_required(self) -> "StatusIn":
        if self.status in ("on_hold", "cancelled") and not (self.note and self.note.strip()):
            raise ValueError("Indica el motivo (se registra en la trazabilidad).")
        return self


class CommentIn(BaseModel):
    note: str = Field(min_length=1, max_length=10000)
    # public=True: mensaje al solicitante (se envía por correo y se ve en el portal).
    public: bool = False


class ResponseIn(BaseModel):
    body: str = Field(min_length=10, max_length=50000)
    # "draft" guarda; "submit" envía a aprobación; "send" aprueba y envía (requiere pqrs.approve).
    action: Literal["draft", "submit", "send"] = "submit"


class ReviewIn(BaseModel):
    note: str | None = Field(default=None, max_length=5000)
    body: str | None = Field(default=None, min_length=10, max_length=50000)  # el aprobador puede ajustar


class PublicMessageIn(BaseModel):
    message: str = Field(min_length=3, max_length=10000)


# --- Salidas ---

class Named(BaseModel):
    id: uuid.UUID
    name: str


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    at: datetime
    kind: str
    actor_label: str | None
    from_status: str | None
    to_status: str | None
    note: str | None
    internal: bool
    data: dict


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    mime: str
    size: int
    source: str
    public: bool
    created_at: datetime


class ResponseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    body: str
    status: str
    author_id: uuid.UUID | None
    author_name: str | None = None
    submitted_at: datetime | None
    reviewer_id: uuid.UUID | None
    reviewer_name: str | None = None
    reviewed_at: datetime | None
    review_note: str | None
    has_pdf: bool = False
    sent_at: datetime | None
    sent_to: str | None
    created_at: datetime


class SlaOut(BaseModel):
    due_at: datetime | None
    warning_at: datetime | None
    state: SlaState | None
    policy: dict
    paused: bool
    first_response_at: datetime | None
    resolved_at: datetime | None


class PqrsSummary(BaseModel):
    id: uuid.UUID
    radicado: str
    segment: Segment
    channel: str
    status: Status
    priority: Priority
    subject: str
    request_type: Named | None
    category: Named | None
    area: Named | None
    client: Named | None
    site: Named | None
    requester_name: str | None
    assignee: Named | None
    created_at: datetime
    sla_due_at: datetime | None
    sla_state: SlaState | None
    requires_rca: bool = False
    rca_status: str | None = None


class PqrsPage(BaseModel):
    items: list[PqrsSummary]
    total: int
    page: int
    page_size: int


class PqrsDetail(PqrsSummary):
    public_code: str
    description: str
    subcategory: Named | None
    employee: Named | None
    is_anonymous: bool
    requester: RequesterIn
    consent_at: datetime | None
    external_ref: str | None
    created_by: Named | None
    sla: SlaOut
    events: list[EventOut]
    attachments: list[AttachmentOut]
    responses: list[ResponseOut]


class PublicEvent(BaseModel):
    at: datetime
    kind: str
    to_status: str | None
    note: str | None


class PublicStatusOut(BaseModel):
    radicado: str
    status: Status
    subject: str
    request_type: str | None
    created_at: datetime
    sla_due_at: datetime | None
    events: list[PublicEvent]
    response_available: bool
    response_sent_at: datetime | None
    can_reply: bool
    attachments: list[AttachmentOut]


# --- Análisis de causa raíz ---

RcaMethod = Literal["five_whys", "ishikawa", "free"]
CauseCategory = Literal["people", "method", "materials", "machine", "measurement", "environment"]


class RcaSetupIn(BaseModel):
    method: RcaMethod = "five_whys"
    problem_statement: str = Field(min_length=10, max_length=10000)
    area_ids: list[uuid.UUID] = Field(min_length=1)


class RcaContributionIn(BaseModel):
    analysis: str = Field(min_length=10, max_length=20000)
    whys: list[str] = Field(default_factory=list, max_length=7)


class RcaConsolidateIn(BaseModel):
    root_cause: str = Field(min_length=10, max_length=20000)
    cause_category: CauseCategory


class RcaValidateIn(BaseModel):
    plan_required: bool
    note: str = Field(min_length=5, max_length=10000)


class RcaActionIn(BaseModel):
    title: str = Field(min_length=3, max_length=250)
    description: str | None = Field(default=None, max_length=10000)
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    priority: Priority = "medium"


class RcaCloseIn(BaseModel):
    summary: str | None = Field(default=None, max_length=10000)


class RcaReopenIn(BaseModel):
    note: str = Field(min_length=5, max_length=5000)


class RcaParticipantOut(BaseModel):
    area: Named
    analysis: str | None
    whys: list[str]
    contributed_by: str | None
    contributed_at: datetime | None
    can_contribute: bool


class RcaActionOut(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    due_date: date | None
    assignee: str | None
    overdue: bool


class RcaOut(BaseModel):
    status: Literal["setup", "analysis", "validation", "plan", "closed"]
    method: RcaMethod
    problem_statement: str | None
    root_cause: str | None
    cause_category: CauseCategory | None
    consolidated_at: datetime | None
    consolidated_by: str | None
    plan_required: bool | None
    validation_note: str | None
    validated_at: datetime | None
    validated_by: str | None
    plan_summary: str | None
    closed_at: datetime | None
    closed_by: str | None
    participants: list[RcaParticipantOut]
    actions: list[RcaActionOut]
    can_manage: bool

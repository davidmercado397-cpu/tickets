from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, IdMixin, JSONType, TenantMixin, TimestampMixin, UTCDateTime, utcnow

STATUSES = ("received", "assigned", "in_progress", "on_hold", "pending_approval", "responded", "cancelled")
FINAL_STATUSES = ("responded", "cancelled")
CHANNELS = ("web", "manual", "email", "whatsapp", "integration")


class Pqrs(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "pqrs"
    __table_args__ = (UniqueConstraint("tenant_id", "radicado", name="uq_pqrs_tenant_radicado"),)

    radicado: Mapped[str] = mapped_column(String(40), index=True)
    public_code: Mapped[str] = mapped_column(String(12))
    segment: Mapped[str] = mapped_column(String(10), index=True)  # external | internal
    channel: Mapped[str] = mapped_column(String(15), index=True)
    status: Mapped[str] = mapped_column(String(20), index=True, default="received")
    priority: Mapped[str] = mapped_column(String(10), default="medium")

    # Clasificación (referencias a otros módulos por id; sin relaciones ORM entre módulos).
    request_type_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("request_types.id"), index=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("categories.id"), nullable=True, index=True)
    subcategory_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("subcategories.id"), nullable=True)
    area_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("areas.id"), nullable=True, index=True)

    subject: Mapped[str] = mapped_column(String(250))
    description: Mapped[str] = mapped_column(Text)

    # Solicitante
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    client_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("clients.id"), nullable=True, index=True)
    site_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("sites.id"), nullable=True, index=True)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("employees.id"), nullable=True, index=True)
    requester_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    requester_doc_type: Mapped[str | None] = mapped_column(String(5), nullable=True)
    requester_document: Mapped[str | None] = mapped_column(String(30), nullable=True)
    requester_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    requester_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    requester_company: Mapped[str | None] = mapped_column(String(200), nullable=True)
    requester_address: Mapped[str | None] = mapped_column(String(250), nullable=True)
    consent_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    assignee_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True, index=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    external_ref: Mapped[str | None] = mapped_column(String(250), nullable=True, index=True)

    # SLA (no bloqueante). `sla_policy` guarda la política aplicada y los intervalos de pausa.
    sla_due_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True, index=True)
    sla_warning_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    sla_policy: Mapped[dict] = mapped_column(JSONType(), default=dict)
    paused_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    first_response_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    sla_alerted: Mapped[str | None] = mapped_column(String(20), nullable=True)  # última alerta enviada

    events: Mapped[list[PqrsEvent]] = relationship(
        cascade="all, delete-orphan", order_by="PqrsEvent.at", lazy="raise"
    )
    attachments: Mapped[list[PqrsAttachment]] = relationship(
        cascade="all, delete-orphan", order_by="PqrsAttachment.created_at", lazy="raise"
    )
    responses: Mapped[list[PqrsResponse]] = relationship(
        cascade="all, delete-orphan", order_by="PqrsResponse.created_at", lazy="raise"
    )


class PqrsEvent(IdMixin, Base):
    """Trazabilidad completa del caso. `internal=True` no se muestra en el portal."""

    __tablename__ = "pqrs_events"

    pqrs_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("pqrs.id", ondelete="CASCADE"), index=True)
    at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    kind: Mapped[str] = mapped_column(String(30))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    actor_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal: Mapped[bool] = mapped_column(Boolean, default=True)
    data: Mapped[dict] = mapped_column(JSONType(), default=dict)


class PqrsAttachment(IdMixin, TenantMixin, Base):
    __tablename__ = "pqrs_attachments"

    pqrs_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("pqrs.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(300))
    filename: Mapped[str] = mapped_column(String(200))
    mime: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(15), default="staff")  # requester | staff | response
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    public: Mapped[bool] = mapped_column(Boolean, default=False)  # visible en el portal
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class PqrsResponse(IdMixin, TenantMixin, TimestampMixin, Base):
    """Respuesta formal: proyectada → en aprobación → aprobada y enviada (o devuelta)."""

    __tablename__ = "pqrs_responses"

    pqrs_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("pqrs.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft|pending_approval|returned|sent
    author_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    signer_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    pdf_key: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    sent_to: Mapped[str | None] = mapped_column(String(250), nullable=True)

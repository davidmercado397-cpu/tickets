from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, IdMixin, JSONType, TenantMixin, TimestampMixin, UTCDateTime, utcnow


class VisitForm(IdMixin, TenantMixin, TimestampMixin, Base):
    """Formulario dinámico (encuesta) que diligencia el jefe de operación en la visita."""

    __tablename__ = "visit_forms"

    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    fields: Mapped[list] = mapped_column(JSONType(), default=list)
    version: Mapped[int] = mapped_column(Integer, default=1)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class VisitQuota(IdMixin, TenantMixin, TimestampMixin, Base):
    """Meta mensual de visitas por cliente (todas sus sedes) o por sede/puesto."""

    __tablename__ = "visit_quotas"
    __table_args__ = (UniqueConstraint("tenant_id", "client_id", "site_id", name="uq_visit_quotas_target"),)

    client_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("clients.id", ondelete="CASCADE"), nullable=True)
    site_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("sites.id", ondelete="CASCADE"), nullable=True)
    visits_per_month: Mapped[int] = mapped_column(Integer)
    form_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("visit_forms.id", ondelete="SET NULL"), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Visit(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "visits"

    form_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("visit_forms.id"), index=True)
    form_version: Mapped[int] = mapped_column(Integer)
    form_snapshot: Mapped[dict] = mapped_column(JSONType(), default=dict)  # nombre + campos al momento de la visita
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clients.id"), index=True)
    site_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("sites.id"), index=True)
    visitor_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(15), default="draft", index=True)  # draft | completed
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True, index=True)
    answers: Mapped[dict] = mapped_column(JSONType(), default=dict)
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    findings: Mapped[list] = mapped_column(JSONType(), default=list)


class VisitFile(IdMixin, TenantMixin, Base):
    __tablename__ = "visit_files"

    visit_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("visits.id", ondelete="CASCADE"), index=True)
    field_id: Mapped[str] = mapped_column(String(40))
    key: Mapped[str] = mapped_column(String(300))
    filename: Mapped[str] = mapped_column(String(200))
    mime: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

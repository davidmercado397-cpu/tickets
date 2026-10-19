"""Modelos ORM (SQLAlchemy 2.0). Único lugar que conoce el esquema físico.

Uso EXPLÍCITO del ORM (nada de magia): tipado con `Mapped`, sin lazy-load implícito (los repos cargan
relaciones con `selectinload`). Enums de dominio se guardan como su `.value` (String) por portabilidad
PG/SQLite; los repos reconstruyen el enum al leer. IDs en UUID vía el tipo portable `GUID`.

En Postgres el esquema lo gestiona Alembic; en SQLite (tests) se usa `create_all` sobre este metadata."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.adapters.types import GUID


class Base(DeclarativeBase):
    """Base declarativa. Todo el metadata cuelga de aquí (create_all / Alembic lo ven completo)."""


def _jsonb() -> Any:
    """JSONB en Postgres (indexable), JSON en SQLite (tests). Una instancia por columna."""
    return JSON().with_variant(JSONB(), "postgresql")


class AreaRow(Base):
    """Área/departamento responsable. Catálogo de referencia."""

    __tablename__ = "areas"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    # code: identificador público, único e INMUTABLE (lo referencia el Gateway).
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(256))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CategoryRow(Base):
    """Categoría (subtipo de solicitud). Pertenece a un área (1—*)."""

    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(256))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    area_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("areas.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    area: Mapped[AreaRow] = relationship("AreaRow", lazy="raise")


class TicketRow(Base):
    __tablename__ = "tickets"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    radicado: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), index=True)
    # area_id es NOT NULL: todo ticket tiene área (derivada de la categoría). Ver ticket_service.
    category_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("categories.id"), nullable=False, index=True
    )
    area_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("areas.id"), nullable=False, index=True
    )
    priority: Mapped[str | None] = mapped_column(String(10), nullable=True)
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    assignee: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)
    channel: Mapped[str | None] = mapped_column(String(32), nullable=True)
    conversation_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    contact_wa_id: Mapped[str] = mapped_column(String(32))
    contact_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    contact_document: Mapped[str | None] = mapped_column(String(64), nullable=True)
    fields: Mapped[dict] = mapped_column(_jsonb(), default=dict)
    # SLA (calendario). due_* se fijan al crear; *_at reales al transicionar.
    response_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category: Mapped[CategoryRow] = relationship("CategoryRow", lazy="raise")
    area: Mapped[AreaRow] = relationship("AreaRow", lazy="raise")
    attachments: Mapped[list[TicketAttachmentRow]] = relationship(
        "TicketAttachmentRow",
        cascade="all, delete-orphan",
        order_by="TicketAttachmentRow.created_at",
        lazy="raise",
    )
    history: Mapped[list[TicketHistoryRow]] = relationship(
        "TicketHistoryRow",
        cascade="all, delete-orphan",
        order_by="TicketHistoryRow.at",
        lazy="raise",
    )


class TicketAttachmentRow(Base):
    """Adjunto referenciado por URL pública (R2 del Gateway). Solo metadata; no se descarga."""

    __tablename__ = "ticket_attachments"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("tickets.id", ondelete="CASCADE"), index=True
    )
    url: Mapped[str] = mapped_column(Text)
    mime: Mapped[str | None] = mapped_column(String(128), nullable=True)
    name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class TicketHistoryRow(Base):
    """Traza del ticket: cada cambio de estado deja una entrada (auditoría de la propuesta)."""

    __tablename__ = "ticket_history"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("tickets.id", ondelete="CASCADE"), index=True
    )
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(20))
    actor: Mapped[str | None] = mapped_column(String(16), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class CounterRow(Base):
    """Contador atómico (secuencia del radicado por año). Portable PG/SQLite."""

    __tablename__ = "counters"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[int] = mapped_column(Integer, default=0)


class SlaPolicyRow(Base):
    """Política de SLA por prioridad (config-as-data). `priority` (value) es la clave."""

    __tablename__ = "sla_policies"

    priority: Mapped[str] = mapped_column(String(10), primary_key=True)
    response_minutes: Mapped[int] = mapped_column(Integer)
    resolution_minutes: Mapped[int] = mapped_column(Integer)


class EmployeeRow(Base):
    """Empleado (tabla propia). `document` (cédula) es la clave pública de consulta."""

    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    document: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(256))
    position: Mapped[str | None] = mapped_column(String(128), nullable=True)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    contract_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    data: Mapped[dict] = mapped_column(_jsonb(), default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# Membresía usuario↔área (muchos-a-muchos): un agente puede pertenecer a varias áreas.
user_areas = Table(
    "user_areas",
    Base.metadata,
    Column("user_id", GUID(), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("area_id", GUID(), ForeignKey("areas.id", ondelete="CASCADE"), primary_key=True),
)


class UserRow(Base):
    """Usuario humano (agente/admin). Contraseña con hash scrypt (salt + hash, nunca en claro)."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    salt: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    role: Mapped[str] = mapped_column(String(16))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    areas: Mapped[list[AreaRow]] = relationship(
        "AreaRow", secondary=user_areas, lazy="raise"
    )


class NotificationRow(Base):
    """Notificación interna (in-app) para un usuario. La base del canal in-app + feed del front."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(256))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    ticket_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    radicado: Mapped[str | None] = mapped_column(String(40), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

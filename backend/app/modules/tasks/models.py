from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, IdMixin, JSONType, TenantMixin, TimestampMixin, UTCDateTime, utcnow

TASK_STATUSES = ("open", "in_progress", "done", "cancelled")


class Task(IdMixin, TenantMixin, TimestampMixin, Base):
    """Tarea de seguimiento. `source_type/source_id` la vinculan a su origen (visita, PQRS, minuta...)."""

    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(250))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(15), default="open", index=True)
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True, index=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    source_type: Mapped[str] = mapped_column(String(20), default="manual", index=True)
    source_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    source_label: Mapped[str | None] = mapped_column(String(250), nullable=True)
    client_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("clients.id"), nullable=True, index=True)
    site_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("sites.id"), nullable=True, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    updates: Mapped[list[TaskUpdate]] = relationship(
        cascade="all, delete-orphan", order_by="TaskUpdate.at", lazy="raise"
    )


class TaskUpdate(IdMixin, Base):
    """Bitácora de seguimiento (notas, cambios de estado y evidencias)."""

    __tablename__ = "task_updates"

    task_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    author_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    author_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    from_status: Mapped[str | None] = mapped_column(String(15), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(15), nullable=True)
    # [{key, filename, mime, size}]
    files: Mapped[list] = mapped_column(JSONType(), default=list)

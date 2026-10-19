from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, IdMixin, JSONType, TenantMixin, TimestampMixin

PRIORITIES = ("urgent", "high", "medium", "low")


class SlaPolicy(IdMixin, TenantMixin, TimestampMixin, Base):
    """Tiempo objetivo por prioridad. Editarla solo afecta a casos nuevos."""

    __tablename__ = "sla_policies"
    __table_args__ = (UniqueConstraint("tenant_id", "priority", name="uq_sla_policies_tenant_priority"),)

    priority: Mapped[str] = mapped_column(String(10))
    target_value: Mapped[int] = mapped_column(Integer, default=15)
    unit: Mapped[str] = mapped_column(String(20), default="business_days")
    pause_on_hold: Mapped[bool] = mapped_column(Boolean, default=True)
    warning_percent: Mapped[int] = mapped_column(Integer, default=80)


class BusinessCalendar(TimestampMixin, Base):
    __tablename__ = "business_calendars"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True
    )
    timezone: Mapped[str] = mapped_column(String(60), default="America/Bogota")
    workdays: Mapped[list] = mapped_column(JSONType(), default=lambda: [0, 1, 2, 3, 4])
    work_start: Mapped[str] = mapped_column(String(5), default="08:00")
    work_end: Mapped[str] = mapped_column(String(5), default="17:00")
    country: Mapped[str | None] = mapped_column(String(2), nullable=True, default="CO")


class Holiday(IdMixin, TenantMixin, Base):
    """Festivo o día no hábil propio de la empresa (además de los nacionales)."""

    __tablename__ = "holidays"
    __table_args__ = (UniqueConstraint("tenant_id", "day", name="uq_holidays_tenant_day"),)

    day: Mapped[date] = mapped_column(Date)
    name: Mapped[str] = mapped_column(String(150))

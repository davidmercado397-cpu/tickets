from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, IdMixin, JSONType, TenantMixin, TimestampMixin


class Employee(IdMixin, TenantMixin, TimestampMixin, Base):
    """Empleado de la empresa (cliente interno de las PQRS)."""

    __tablename__ = "employees"
    __table_args__ = (UniqueConstraint("tenant_id", "document", name="uq_employees_tenant_document"),)

    document_type: Mapped[str] = mapped_column(String(5), default="CC")
    document: Mapped[str] = mapped_column(String(30), index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    position: Mapped[str | None] = mapped_column(String(150), nullable=True)
    # Puesto asignado actualmente (para relacionar PQRS internas con la operación).
    site_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("sites.id", ondelete="SET NULL"), nullable=True)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    contract_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | retired
    data: Mapped[dict] = mapped_column(JSONType(), default=dict)

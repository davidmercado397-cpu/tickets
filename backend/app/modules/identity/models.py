from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, ForeignKey, String, Table, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, IdMixin, JSONType, TenantMixin, TimestampMixin, UTCDateTime

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

user_areas = Table(
    "user_areas",
    Base.metadata,
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("area_id", Uuid, ForeignKey("areas.id", ondelete="CASCADE"), primary_key=True),
)


class Area(IdMixin, TenantMixin, TimestampMixin, Base):
    """Área/dependencia responsable (Operaciones, Gestión Humana, Facturación...)."""

    __tablename__ = "areas"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_areas_tenant_code"),)

    code: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Role(IdMixin, TenantMixin, TimestampMixin, Base):
    """Rol dinámico de una empresa = conjunto de códigos de permiso."""

    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_roles_tenant_code"),)

    code: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    # El rol "admin" de cada empresa tiene SIEMPRE todos los permisos (incluso los futuros).
    all_permissions: Mapped[bool] = mapped_column(Boolean, default=False)
    permissions: Mapped[list] = mapped_column(JSONType(), default=list)


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"

    # None = superadministrador de la plataforma.
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=True
    )
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    position: Mapped[str | None] = mapped_column(String(150), nullable=True)  # cargo (firma de cartas)
    signature_key: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    roles: Mapped[list[Role]] = relationship(secondary=user_roles, lazy="selectin")
    areas: Mapped[list[Area]] = relationship(secondary=user_areas, lazy="selectin")

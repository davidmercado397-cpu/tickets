from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, IdMixin, TenantMixin, TimestampMixin

SEGMENTS = ("external", "internal")


class RequestType(IdMixin, TenantMixin, TimestampMixin, Base):
    """Tipo de solicitud: petición, queja, reclamo, sugerencia, felicitación, denuncia."""

    __tablename__ = "request_types"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_request_types_tenant_code"),)

    code: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Category(IdMixin, TenantMixin, TimestampMixin, Base):
    """Categoría por segmento (externo/interno) y, opcionalmente, por tipo de solicitud."""

    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_categories_tenant_code"),)

    segment: Mapped[str] = mapped_column(String(10), index=True)
    # None = aplica a todos los tipos de solicitud.
    request_type_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("request_types.id", ondelete="SET NULL"), nullable=True
    )
    code: Mapped[str] = mapped_column(String(60))
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_area_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("areas.id", ondelete="SET NULL"), nullable=True
    )
    default_priority: Mapped[str | None] = mapped_column(String(10), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    subcategories: Mapped[list[Subcategory]] = relationship(
        back_populates="category", lazy="selectin", order_by="Subcategory.name"
    )


class Subcategory(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "subcategories"
    __table_args__ = (
        UniqueConstraint("category_id", "code", name="uq_subcategories_category_code"),
    )

    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("categories.id", ondelete="CASCADE"), index=True
    )
    code: Mapped[str] = mapped_column(String(60))
    name: Mapped[str] = mapped_column(String(150))
    # Si se definen, prevalecen sobre las de la categoría.
    default_area_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("areas.id", ondelete="SET NULL"), nullable=True
    )
    default_priority: Mapped[str | None] = mapped_column(String(10), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped[Category] = relationship(back_populates="subcategories", lazy="raise")

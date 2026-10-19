from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, IdMixin, JSONType, TenantMixin, TimestampMixin, UTCDateTime


class Tenant(IdMixin, TimestampMixin, Base):
    """Empresa de seguridad cliente de la plataforma."""

    __tablename__ = "tenants"

    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    legal_name: Mapped[str | None] = mapped_column(String(250), nullable=True)
    nit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    radicado_prefix: Mapped[str] = mapped_column(String(10), default="PQRS")
    address: Mapped[str | None] = mapped_column(String(250), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    website: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Marca (la app se pinta con estos colores y logo).
    primary_color: Mapped[str] = mapped_column(String(9), default="#0B3D91")
    secondary_color: Mapped[str] = mapped_column(String(9), default="#F2A900")
    logo_key: Mapped[str | None] = mapped_column(String(300), nullable=True)
    logo_mime: Mapped[str | None] = mapped_column(String(60), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Ajustes de negocio flexibles: textos del portal, carta de respuesta, buzón IMAP (clave cifrada)...
    settings: Mapped[dict] = mapped_column(JSONType(), default=dict)


class IntegrationKey(IdMixin, TenantMixin, TimestampMixin, Base):
    """API key de una empresa para integraciones (bot WhatsApp, módulo de minutas...). Solo hash."""

    __tablename__ = "integration_keys"

    name: Mapped[str] = mapped_column(String(100))
    prefix: Mapped[str] = mapped_column(String(12))
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)


class Counter(Base):
    """Secuencias atómicas por empresa (radicados por año, etc.)."""

    __tablename__ = "counters"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True
    )
    name: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[int] = mapped_column(Integer, default=0)



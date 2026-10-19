from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

HEX = r"^#[0-9A-Fa-f]{6}$"


class PortalSettings(BaseModel):
    enabled: bool = True
    welcome: str = (
        "Radica aquí tus peticiones, quejas, reclamos, sugerencias y felicitaciones. "
        "Te responderemos dentro de los términos de ley."
    )
    habeas_data: str = (
        "Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012 y la "
        "política de tratamiento de datos de la empresa, para gestionar esta solicitud."
    )
    allow_anonymous: bool = True


class LetterSettings(BaseModel):
    city: str = ""
    closing: str = "Cordialmente,"
    footer: str = ""
    # Firmante por defecto (si el aprobador no tiene firma propia).
    signer_user_id: uuid.UUID | None = None


class NotificationSettings(BaseModel):
    email_requester_on_create: bool = True
    email_staff: bool = True


class EmailInboundSettings(BaseModel):
    enabled: bool = False
    host: str = ""
    port: int = 993
    username: str = ""
    folder: str = "INBOX"
    use_ssl: bool = True
    has_password: bool = False


class EmailInboundUpdate(BaseModel):
    enabled: bool
    host: str = ""
    port: int = 993
    username: str = ""
    password: str | None = None  # None = conservar la actual
    folder: str = "INBOX"
    use_ssl: bool = True


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    legal_name: str | None
    nit: str | None
    radicado_prefix: str
    address: str | None
    city: str | None
    phone: str | None
    email: str | None
    website: str | None
    primary_color: str
    secondary_color: str
    has_logo: bool = False
    active: bool
    created_at: datetime
    portal: PortalSettings = PortalSettings()
    letter: LetterSettings = LetterSettings()
    notifications: NotificationSettings = NotificationSettings()
    email_inbound: EmailInboundSettings = EmailInboundSettings()


class TenantUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    legal_name: str | None = None
    nit: str | None = None
    radicado_prefix: str | None = Field(default=None, pattern=r"^[A-Z0-9]{0,10}$")
    address: str | None = None
    city: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    website: str | None = None
    primary_color: str | None = Field(default=None, pattern=HEX)
    secondary_color: str | None = Field(default=None, pattern=HEX)
    portal: PortalSettings | None = None
    letter: LetterSettings | None = None
    notifications: NotificationSettings | None = None


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9-]{2,60}$")
    nit: str | None = None
    radicado_prefix: str = Field(default="PQRS", pattern=r"^[A-Z0-9]{0,10}$")
    city: str | None = None
    admin_email: EmailStr
    admin_full_name: str = Field(min_length=2, max_length=200)
    admin_password: str = Field(min_length=8, max_length=200)


class PlatformTenantUpdate(BaseModel):
    name: str | None = None
    active: bool | None = None


class PublicTenantOut(BaseModel):
    slug: str
    name: str
    legal_name: str | None
    nit: str | None
    phone: str | None
    email: str | None
    website: str | None
    address: str | None
    city: str | None
    primary_color: str
    secondary_color: str
    has_logo: bool
    portal: PortalSettings


class IntegrationKeyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    prefix: str
    active: bool
    last_used_at: datetime | None
    created_at: datetime


class IntegrationKeyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)


class IntegrationKeyCreated(IntegrationKeyOut):
    key: str  # se muestra UNA sola vez

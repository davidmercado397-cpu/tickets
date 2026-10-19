from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SiteOut(ORM):
    id: uuid.UUID
    client_id: uuid.UUID
    code: str
    name: str
    address: str | None
    city: str | None
    contact_name: str | None
    contact_phone: str | None
    latitude: float | None
    longitude: float | None
    active: bool


class SiteIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    code: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{2,40}$")
    address: str | None = None
    city: str | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class SiteUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    address: str | None = None
    city: str | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    active: bool | None = None


class ClientOut(ORM):
    id: uuid.UUID
    nit: str
    name: str
    contact_name: str | None
    contact_email: str | None
    contact_phone: str | None
    address: str | None
    city: str | None
    contract_start: date | None
    contract_end: date | None
    notes: str | None
    active: bool
    sites: list[SiteOut]


class ClientIn(BaseModel):
    nit: str = Field(min_length=3, max_length=30)
    name: str = Field(min_length=2, max_length=200)
    contact_name: str | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    address: str | None = None
    city: str | None = None
    contract_start: date | None = None
    contract_end: date | None = None
    notes: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    contact_name: str | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    address: str | None = None
    city: str | None = None
    contract_start: date | None = None
    contract_end: date | None = None
    notes: str | None = None
    active: bool | None = None


class PublicSite(BaseModel):
    id: uuid.UUID
    name: str


class PublicClientLookup(BaseModel):
    id: uuid.UUID
    name: str
    sites: list[PublicSite]


class ImportRowError(BaseModel):
    sheet: str
    row: int
    message: str


class ImportResult(BaseModel):
    dry_run: bool
    saved: bool
    clients_created: int
    clients_updated: int
    sites_created: int
    sites_updated: int
    quotas_set: int
    errors: list[ImportRowError]

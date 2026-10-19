from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AreaBrief(ORM):
    id: uuid.UUID
    code: str
    name: str


class RoleBrief(ORM):
    id: uuid.UUID
    code: str
    name: str


class TenantBrief(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    primary_color: str
    secondary_color: str
    has_logo: bool


class MeOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    position: str | None
    is_superadmin: bool
    has_signature: bool
    tenant: TenantBrief | None
    roles: list[RoleBrief]
    areas: list[AreaBrief]
    permissions: list[str]


class MeUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    position: str | None = Field(default=None, max_length=150)
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=200)


# --- Usuarios ---

class UserOut(ORM):
    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    position: str | None
    active: bool
    has_signature: bool = False
    last_login_at: datetime | None
    created_at: datetime
    roles: list[RoleBrief]
    areas: list[AreaBrief]


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=8, max_length=200)
    phone: str | None = None
    position: str | None = None
    role_ids: list[uuid.UUID] = Field(default_factory=list)
    area_ids: list[uuid.UUID] = Field(default_factory=list)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    phone: str | None = None
    position: str | None = None
    active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=200)
    role_ids: list[uuid.UUID] | None = None
    area_ids: list[uuid.UUID] | None = None


class UserLookup(ORM):
    id: uuid.UUID
    email: str
    full_name: str


# --- Roles ---

class RoleOut(ORM):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    is_system: bool
    all_permissions: bool
    permissions: list[str]


class RoleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    code: str | None = Field(default=None, pattern=r"^[a-z0-9_-]{2,40}$")
    description: str | None = None
    permissions: list[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = None
    permissions: list[str] | None = None


class PermissionOut(BaseModel):
    code: str
    label: str
    group: str


# --- Áreas ---

class AreaOut(ORM):
    id: uuid.UUID
    code: str
    name: str
    email: str | None
    active: bool


class AreaCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    code: str | None = Field(default=None, pattern=r"^[a-z0-9_-]{2,40}$")
    email: EmailStr | None = None


class AreaUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    email: EmailStr | None = None
    active: bool | None = None

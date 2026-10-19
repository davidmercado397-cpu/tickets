from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Segment = Literal["external", "internal"]
Priority = Literal["urgent", "high", "medium", "low"]
CODE = r"^[a-z0-9_-]{2,60}$"


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RequestTypeOut(ORM):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    active: bool
    sort_order: int


class RequestTypeIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    code: str | None = Field(default=None, pattern=CODE)
    description: str | None = None
    sort_order: int = 0


class RequestTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = None
    active: bool | None = None
    sort_order: int | None = None


class SubcategoryOut(ORM):
    id: uuid.UUID
    category_id: uuid.UUID
    code: str
    name: str
    default_area_id: uuid.UUID | None
    default_priority: Priority | None
    active: bool


class SubcategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    code: str | None = Field(default=None, pattern=CODE)
    default_area_id: uuid.UUID | None = None
    default_priority: Priority | None = None


class SubcategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    default_area_id: uuid.UUID | None = None
    default_priority: Priority | None = None
    active: bool | None = None


class CategoryOut(ORM):
    id: uuid.UUID
    segment: Segment
    request_type_id: uuid.UUID | None
    code: str
    name: str
    description: str | None
    default_area_id: uuid.UUID | None
    default_priority: Priority | None
    active: bool
    sort_order: int
    subcategories: list[SubcategoryOut]


class CategoryIn(BaseModel):
    segment: Segment
    name: str = Field(min_length=2, max_length=150)
    code: str | None = Field(default=None, pattern=CODE)
    request_type_id: uuid.UUID | None = None
    description: str | None = None
    default_area_id: uuid.UUID | None = None
    default_priority: Priority | None = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    request_type_id: uuid.UUID | None = None
    description: str | None = None
    default_area_id: uuid.UUID | None = None
    default_priority: Priority | None = None
    active: bool | None = None
    sort_order: int | None = None


class PublicSubcategory(BaseModel):
    id: uuid.UUID
    name: str


class PublicCategory(BaseModel):
    id: uuid.UUID
    segment: Segment
    request_type_id: uuid.UUID | None
    name: str
    description: str | None
    subcategories: list[PublicSubcategory]


class PublicRequestType(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None


class PublicCatalogOut(BaseModel):
    request_types: list[PublicRequestType]
    categories: list[PublicCategory]

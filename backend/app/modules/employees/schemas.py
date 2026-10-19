from __future__ import annotations

import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

DocType = Literal["CC", "CE", "TI", "PA", "PPT", "NIT"]


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_type: str
    document: str
    full_name: str
    email: str | None
    phone: str | None
    position: str | None
    site_id: uuid.UUID | None
    hire_date: date | None
    contract_type: str | None
    status: str


class EmployeeIn(BaseModel):
    document_type: DocType = "CC"
    document: str = Field(min_length=3, max_length=30)
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: str | None = None
    position: str | None = None
    site_id: uuid.UUID | None = None
    hire_date: date | None = None
    contract_type: str | None = None
    status: Literal["active", "retired"] = "active"


class EmployeeUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: str | None = None
    position: str | None = None
    site_id: uuid.UUID | None = None
    hire_date: date | None = None
    contract_type: str | None = None
    status: Literal["active", "retired"] | None = None


class EmployeePage(BaseModel):
    items: list[EmployeeOut]
    total: int
    page: int
    page_size: int


class ImportResult(BaseModel):
    created: int
    updated: int
    errors: list[str]

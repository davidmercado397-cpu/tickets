from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Priority = Literal["urgent", "high", "medium", "low"]
Unit = Literal["business_days", "business_hours", "calendar_days", "calendar_hours"]


class PolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    priority: Priority
    target_value: int
    unit: Unit
    pause_on_hold: bool
    warning_percent: int


class PolicyIn(BaseModel):
    target_value: int = Field(ge=1, le=10000)
    unit: Unit
    pause_on_hold: bool = True
    warning_percent: int = Field(default=80, ge=1, le=100)


class CalendarOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    timezone: str
    workdays: list[int]
    work_start: str
    work_end: str
    country: str | None


class CalendarIn(BaseModel):
    timezone: str = "America/Bogota"
    workdays: list[int] = Field(min_length=1)
    work_start: str = Field(pattern=r"^\d{2}:\d{2}$")
    work_end: str = Field(pattern=r"^\d{2}:\d{2}$")
    country: str | None = "CO"


class HolidayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID | None = None
    day: date
    name: str
    national: bool = False


class HolidayIn(BaseModel):
    day: date
    name: str = Field(min_length=2, max_length=150)


class SimulateOut(BaseModel):
    priority: Priority
    start: datetime
    due_at: datetime

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TaskStatus = Literal["open", "in_progress", "done", "cancelled"]
Priority = Literal["urgent", "high", "medium", "low"]


class Named(BaseModel):
    id: uuid.UUID
    name: str


class TaskIn(BaseModel):
    title: str = Field(min_length=3, max_length=250)
    description: str | None = Field(default=None, max_length=10000)
    priority: Priority = "medium"
    due_date: date | None = None
    assignee_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    source_type: Literal["manual", "visit", "pqrs", "minuta", "integration"] = "manual"
    source_id: uuid.UUID | None = None
    source_label: str | None = None


class TaskPatch(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=250)
    description: str | None = None
    priority: Priority | None = None
    due_date: date | None = None
    assignee_id: uuid.UUID | None = None


class FileOut(BaseModel):
    index: int
    filename: str
    mime: str
    size: int


class TaskUpdateOut(BaseModel):
    id: uuid.UUID
    at: datetime
    author_label: str | None
    note: str | None
    from_status: str | None
    to_status: str | None
    files: list[FileOut]


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    status: TaskStatus
    priority: Priority
    due_date: date | None
    overdue: bool = False
    assignee: Named | None = None
    created_by: Named | None = None
    source_type: str
    source_id: uuid.UUID | None
    source_label: str | None
    client: Named | None = None
    site: Named | None = None
    completed_at: datetime | None
    created_at: datetime
    updates: list[TaskUpdateOut] = []


class TaskPage(BaseModel):
    items: list[TaskOut]
    total: int
    page: int
    page_size: int

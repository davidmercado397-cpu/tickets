from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

FieldType = Literal[
    "section", "text", "textarea", "number", "select", "multiselect", "yesno", "rating", "date", "photo", "signature"
]
Priority = Literal["urgent", "high", "medium", "low"]


class FindingRule(BaseModel):
    """Cuándo una respuesta es un hallazgo (y sugiere una tarea)."""

    op: Literal["equals", "not_equals", "lte", "gte", "in"]
    value: Any
    task_title: str | None = Field(default=None, max_length=250)
    priority: Priority = "medium"


class FormField(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9_]{1,40}$")
    type: FieldType
    label: str = Field(min_length=1, max_length=300)
    required: bool = False
    help: str | None = Field(default=None, max_length=500)
    options: list[str] = Field(default_factory=list)
    min: float | None = None
    max: float | None = None
    scored: bool = True  # sí/no y calificación cuentan para el puntaje de la visita
    finding: FindingRule | None = None

    @model_validator(mode="after")
    def _check(self) -> "FormField":
        if self.type in ("select", "multiselect") and len(self.options) < 2:
            raise ValueError(f"El campo '{self.label}' necesita al menos 2 opciones.")
        if self.type == "rating":
            self.min = self.min if self.min is not None else 1
            self.max = self.max if self.max is not None else 5
        return self


class FormIn(BaseModel):
    name: str = Field(min_length=3, max_length=200)
    description: str | None = None
    fields: list[FormField] = Field(min_length=1)
    active: bool = True

    @model_validator(mode="after")
    def _unique(self) -> "FormIn":
        ids = [f.id for f in self.fields]
        if len(ids) != len(set(ids)):
            raise ValueError("Los identificadores de los campos deben ser únicos.")
        return self


class FormOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    fields: list[FormField]
    version: int
    active: bool
    updated_at: datetime


class QuotaIn(BaseModel):
    client_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    visits_per_month: int = Field(ge=0, le=500)
    form_id: uuid.UUID | None = None
    active: bool = True

    @model_validator(mode="after")
    def _target(self) -> "QuotaIn":
        if (self.client_id is None) == (self.site_id is None):
            raise ValueError("Indica el cliente O la sede (uno de los dos).")
        return self


class Named(BaseModel):
    id: uuid.UUID
    name: str


class QuotaOut(BaseModel):
    id: uuid.UUID
    client: Named | None
    site: Named | None
    visits_per_month: int
    form_id: uuid.UUID | None
    active: bool


class VisitStart(BaseModel):
    form_id: uuid.UUID
    site_id: uuid.UUID
    latitude: float | None = None
    longitude: float | None = None


class AnswersIn(BaseModel):
    answers: dict[str, Any] = Field(default_factory=dict)
    observations: str | None = Field(default=None, max_length=20000)


class TaskFromFinding(BaseModel):
    field_id: str | None = None
    title: str = Field(min_length=3, max_length=250)
    description: str | None = None
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    priority: Priority = "medium"


class CompleteIn(AnswersIn):
    latitude: float | None = None
    longitude: float | None = None
    tasks: list[TaskFromFinding] = Field(default_factory=list)


class VisitFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    field_id: str
    filename: str
    mime: str
    size: int


class VisitSummary(BaseModel):
    id: uuid.UUID
    form: Named
    client: Named | None
    site: Named | None
    visitor: Named | None
    status: Literal["draft", "completed"]
    started_at: datetime
    completed_at: datetime | None
    score: float | None
    findings_count: int


class VisitOut(VisitSummary):
    form_version: int
    fields: list[FormField]
    answers: dict[str, Any]
    observations: str | None
    latitude: float | None
    longitude: float | None
    findings: list[dict]
    files: list[VisitFileOut]
    tasks: list[dict]


class VisitPage(BaseModel):
    items: list[VisitSummary]
    total: int
    page: int
    page_size: int


class ComplianceRow(BaseModel):
    level: Literal["client", "site"]
    client: Named | None
    site: Named | None
    required: int
    done: int
    percent: float


class ComplianceOut(BaseModel):
    month: str
    required: int
    done_capped: int
    percent: float
    rows: list[ComplianceRow]

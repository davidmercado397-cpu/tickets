"""Lógica de empleados. Depende del puerto `EmployeeDirectory` (hoy tabla propia; mañana quizá ERP)."""

from __future__ import annotations

from datetime import date

from app.domain.errors import ConflictError, NotFoundError, ValidationError
from app.domain.models import Employee
from app.domain.ports import EmployeeDirectory


class EmployeeService:
    def __init__(self, directory: EmployeeDirectory) -> None:
        self._dir = directory

    async def get(self, document: str) -> Employee:
        emp = await self._dir.get_by_document(document)
        if emp is None:
            raise NotFoundError(f"No existe un empleado con documento '{document}'.")
        return emp

    async def list(
        self, *, q: str | None, page: int, page_size: int
    ) -> tuple[list[Employee], int]:
        return await self._dir.list(q=q, page=page, page_size=page_size)

    async def create(
        self,
        *,
        document: str,
        full_name: str,
        position: str | None = None,
        hire_date: date | None = None,
        contract_type: str | None = None,
        status: str | None = None,
        data: dict | None = None,
    ) -> Employee:
        document = document.strip()
        if not document:
            raise ValidationError("El documento es obligatorio.")
        if await self._dir.get_by_document(document) is not None:
            raise ConflictError(f"Ya existe un empleado con documento '{document}'.")
        return await self._dir.create(
            document=document,
            full_name=full_name,
            position=position,
            hire_date=hire_date,
            contract_type=contract_type,
            status=status,
            data=data or {},
        )

    async def update(
        self,
        document: str,
        *,
        full_name: str | None = None,
        position: str | None = None,
        hire_date: date | None = None,
        contract_type: str | None = None,
        status: str | None = None,
        data: dict | None = None,
    ) -> Employee:
        emp = await self._dir.update(
            document,
            full_name=full_name,
            position=position,
            hire_date=hire_date,
            contract_type=contract_type,
            status=status,
            data=data,
        )
        if emp is None:
            raise NotFoundError(f"No existe un empleado con documento '{document}'.")
        return emp

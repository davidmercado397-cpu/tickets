"""Repositorio de empleados (tabla propia) sobre PostgreSQL async. Implementa `EmployeeDirectory`.

Es la implementación "propia" del directorio; el día que se integre el ERP, se sustituye este adapter
(al menos `get_by_document`) por un proxy, sin tocar los servicios."""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.adapters.db_models import EmployeeRow
from app.domain.models import Employee


def _to_employee(row: EmployeeRow) -> Employee:
    return Employee(
        document=row.document,
        full_name=row.full_name,
        position=row.position,
        hire_date=row.hire_date,
        contract_type=row.contract_type,
        status=row.status,
        data=row.data or {},
    )


class SqlAlchemyEmployeeRepository:
    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._sf = session_factory

    async def get_by_document(self, document: str) -> Employee | None:
        async with self._sf() as session:
            row = (
                await session.execute(
                    select(EmployeeRow).where(EmployeeRow.document == document)
                )
            ).scalar_one_or_none()
            return _to_employee(row) if row else None

    async def list(
        self, *, q: str | None, page: int, page_size: int
    ) -> tuple[list[Employee], int]:
        async with self._sf() as session:
            stmt = select(EmployeeRow)
            count_stmt = select(func.count()).select_from(EmployeeRow)
            if q:
                like = f"%{q}%"
                cond = or_(EmployeeRow.document.ilike(like), EmployeeRow.full_name.ilike(like))
                stmt = stmt.where(cond)
                count_stmt = count_stmt.where(cond)
            total = (await session.execute(count_stmt)).scalar_one()
            stmt = (
                stmt.order_by(EmployeeRow.full_name)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [_to_employee(r) for r in rows], total

    async def create(
        self,
        *,
        document: str,
        full_name: str,
        position: str | None,
        hire_date: date | None,
        contract_type: str | None,
        status: str | None,
        data: dict,
    ) -> Employee:
        async with self._sf() as session:
            row = EmployeeRow(
                document=document,
                full_name=full_name,
                position=position,
                hire_date=hire_date,
                contract_type=contract_type,
                status=status,
                data=data or {},
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return _to_employee(row)

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
    ) -> Employee | None:
        async with self._sf() as session:
            row = (
                await session.execute(
                    select(EmployeeRow).where(EmployeeRow.document == document)
                )
            ).scalar_one_or_none()
            if row is None:
                return None
            if full_name is not None:
                row.full_name = full_name
            if position is not None:
                row.position = position
            if hire_date is not None:
                row.hire_date = hire_date
            if contract_type is not None:
                row.contract_type = contract_type
            if status is not None:
                row.status = status
            if data is not None:
                row.data = data
            await session.commit()
            await session.refresh(row)
            return _to_employee(row)

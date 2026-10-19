"""Repositorios de catálogo (áreas y categorías) sobre PostgreSQL async.

Implementan los puertos `AreaRepository`/`CategoryRepository`. Mapean filas ORM ↔ dataclasses de
dominio; el resto de la app nunca ve SQLAlchemy. Carga EXPLÍCITA de la relación `area` (selectinload):
nada de lazy-load implícito."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm import selectinload

from app.adapters.db_models import AreaRow, CategoryRow
from app.domain.models import Area, Category


def _to_area(row: AreaRow) -> Area:
    return Area(id=row.id, code=row.code, name=row.name, active=row.active)


def _to_category(row: CategoryRow) -> Category:
    # `row.area` debe venir cargado (selectinload); si no, es un bug de la query, no un lazy-load.
    return Category(
        id=row.id,
        code=row.code,
        name=row.name,
        active=row.active,
        area_id=row.area_id,
        area_code=row.area.code,
    )


class SqlAlchemyAreaRepository:
    """Adaptador Postgres del puerto AreaRepository."""

    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._sf = session_factory

    async def list(self, only_active: bool = False) -> list[Area]:
        async with self._sf() as session:
            stmt = select(AreaRow).order_by(AreaRow.name)
            if only_active:
                stmt = stmt.where(AreaRow.active.is_(True))
            rows = (await session.execute(stmt)).scalars().all()
            return [_to_area(r) for r in rows]

    async def get(self, area_id: uuid.UUID) -> Area | None:
        async with self._sf() as session:
            row = await session.get(AreaRow, area_id)
            return _to_area(row) if row else None

    async def get_by_code(self, code: str) -> Area | None:
        async with self._sf() as session:
            row = (
                await session.execute(select(AreaRow).where(AreaRow.code == code))
            ).scalar_one_or_none()
            return _to_area(row) if row else None

    async def create(self, code: str, name: str) -> Area:
        async with self._sf() as session:
            row = AreaRow(code=code, name=name, active=True)
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return _to_area(row)

    async def update(
        self, area_id: uuid.UUID, name: str | None = None, active: bool | None = None
    ) -> Area | None:
        async with self._sf() as session:
            row = await session.get(AreaRow, area_id)
            if row is None:
                return None
            if name is not None:
                row.name = name
            if active is not None:
                row.active = active
            await session.commit()
            await session.refresh(row)
            return _to_area(row)


class SqlAlchemyCategoryRepository:
    """Adaptador Postgres del puerto CategoryRepository."""

    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._sf = session_factory

    async def list(self, only_active: bool = False) -> list[Category]:
        async with self._sf() as session:
            stmt = (
                select(CategoryRow)
                .options(selectinload(CategoryRow.area))
                .order_by(CategoryRow.name)
            )
            if only_active:
                stmt = stmt.where(CategoryRow.active.is_(True))
            rows = (await session.execute(stmt)).scalars().all()
            return [_to_category(r) for r in rows]

    async def get(self, category_id: uuid.UUID) -> Category | None:
        async with self._sf() as session:
            row = (
                await session.execute(
                    select(CategoryRow)
                    .options(selectinload(CategoryRow.area))
                    .where(CategoryRow.id == category_id)
                )
            ).scalar_one_or_none()
            return _to_category(row) if row else None

    async def get_by_code(self, code: str) -> Category | None:
        async with self._sf() as session:
            row = (
                await session.execute(
                    select(CategoryRow)
                    .options(selectinload(CategoryRow.area))
                    .where(CategoryRow.code == code)
                )
            ).scalar_one_or_none()
            return _to_category(row) if row else None

    async def create(self, code: str, name: str, area_id: uuid.UUID) -> Category:
        async with self._sf() as session:
            row = CategoryRow(code=code, name=name, area_id=area_id, active=True)
            session.add(row)
            await session.commit()
            # Re-cargar con el área para exponer area_code sin lazy-load.
            loaded = (
                await session.execute(
                    select(CategoryRow)
                    .options(selectinload(CategoryRow.area))
                    .where(CategoryRow.id == row.id)
                )
            ).scalar_one()
            return _to_category(loaded)

    async def update(
        self, category_id: uuid.UUID, name: str | None = None, active: bool | None = None
    ) -> Category | None:
        async with self._sf() as session:
            row = (
                await session.execute(
                    select(CategoryRow)
                    .options(selectinload(CategoryRow.area))
                    .where(CategoryRow.id == category_id)
                )
            ).scalar_one_or_none()
            if row is None:
                return None
            if name is not None:
                row.name = name
            if active is not None:
                row.active = active
            await session.commit()
            await session.refresh(row, attribute_names=["name", "active"])
            return _to_category(row)

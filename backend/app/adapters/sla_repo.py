"""Repositorio de políticas de SLA (config-as-data) sobre PostgreSQL async."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.adapters.db_models import SlaPolicyRow
from app.domain.models import Priority, SlaPolicy


def _to_policy(row: SlaPolicyRow) -> SlaPolicy:
    return SlaPolicy(
        priority=Priority(row.priority),
        response_minutes=row.response_minutes,
        resolution_minutes=row.resolution_minutes,
    )


class SqlAlchemySlaPolicyRepository:
    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._sf = session_factory

    async def list(self) -> list[SlaPolicy]:
        async with self._sf() as session:
            rows = (await session.execute(select(SlaPolicyRow))).scalars().all()
            return [_to_policy(r) for r in rows]

    async def get(self, priority: Priority) -> SlaPolicy | None:
        async with self._sf() as session:
            row = await session.get(SlaPolicyRow, priority.value)
            return _to_policy(row) if row else None

    async def upsert(
        self, priority: Priority, response_minutes: int, resolution_minutes: int
    ) -> SlaPolicy:
        async with self._sf() as session:
            row = await session.get(SlaPolicyRow, priority.value)
            if row is None:
                row = SlaPolicyRow(priority=priority.value)
                session.add(row)
            row.response_minutes = response_minutes
            row.resolution_minutes = resolution_minutes
            await session.commit()
            await session.refresh(row)
            return _to_policy(row)

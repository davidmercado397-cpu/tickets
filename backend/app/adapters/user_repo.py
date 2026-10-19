"""Repositorio de usuarios sobre PostgreSQL async. Implementa el puerto UserRepository.

Mapea filas ORM ↔ dataclass `User` (que NUNCA incluye el hash/salt). La membresía de áreas se carga
con selectinload (area_codes)."""

from __future__ import annotations

import uuid

from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm import selectinload

from app.adapters.db_models import AreaRow, UserRow, user_areas
from app.domain.models import Role, User


def _to_user(row: UserRow) -> User:
    return User(
        id=row.id,
        email=row.email,
        role=Role(row.role),
        active=row.active,
        display_name=row.display_name,
        phone=row.phone,
        area_codes=sorted(a.code for a in row.areas),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class SqlAlchemyUserRepository:
    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._sf = session_factory

    async def _load(self, session, user_id: uuid.UUID) -> UserRow | None:
        return (
            await session.execute(
                select(UserRow).options(selectinload(UserRow.areas)).where(UserRow.id == user_id)
            )
        ).scalar_one_or_none()

    async def create(
        self,
        *,
        email: str,
        password_hash: str,
        salt: str,
        display_name: str | None,
        phone: str | None,
        role: Role,
        area_ids: list[uuid.UUID],
    ) -> User:
        async with self._sf() as session:
            row = UserRow(
                email=email,
                password_hash=password_hash,
                salt=salt,
                display_name=display_name,
                phone=phone,
                role=role.value,
                active=True,
            )
            session.add(row)
            await session.flush()
            if area_ids:
                await session.execute(
                    insert(user_areas),
                    [{"user_id": row.id, "area_id": aid} for aid in area_ids],
                )
            await session.commit()
            loaded = await self._load(session, row.id)
            assert loaded is not None
            return _to_user(loaded)

    async def get(self, user_id: uuid.UUID) -> User | None:
        async with self._sf() as session:
            row = await self._load(session, user_id)
            return _to_user(row) if row else None

    async def get_by_email(self, email: str) -> User | None:
        async with self._sf() as session:
            row = (
                await session.execute(
                    select(UserRow)
                    .options(selectinload(UserRow.areas))
                    .where(UserRow.email == email)
                )
            ).scalar_one_or_none()
            return _to_user(row) if row else None

    async def list(self) -> list[User]:
        async with self._sf() as session:
            rows = (
                await session.execute(
                    select(UserRow).options(selectinload(UserRow.areas)).order_by(UserRow.email)
                )
            ).scalars().all()
            return [_to_user(r) for r in rows]

    async def list_by_area_code(self, area_code: str) -> list[User]:
        async with self._sf() as session:
            rows = (
                await session.execute(
                    select(UserRow)
                    .options(selectinload(UserRow.areas))
                    .join(user_areas, UserRow.id == user_areas.c.user_id)
                    .join(AreaRow, AreaRow.id == user_areas.c.area_id)
                    .where(AreaRow.code == area_code, UserRow.active.is_(True))
                )
            ).scalars().unique().all()
            return [_to_user(r) for r in rows]

    async def get_auth_by_email(self, email: str) -> tuple[User, str, str] | None:
        async with self._sf() as session:
            row = (
                await session.execute(
                    select(UserRow)
                    .options(selectinload(UserRow.areas))
                    .where(UserRow.email == email)
                )
            ).scalar_one_or_none()
            if row is None:
                return None
            return _to_user(row), row.salt, row.password_hash

    async def update(
        self,
        user_id: uuid.UUID,
        *,
        display_name: str | None = None,
        phone: str | None = None,
        role: Role | None = None,
        active: bool | None = None,
        password_hash: str | None = None,
        salt: str | None = None,
    ) -> User | None:
        async with self._sf() as session:
            row = await self._load(session, user_id)
            if row is None:
                return None
            if display_name is not None:
                row.display_name = display_name
            if phone is not None:
                row.phone = phone
            if role is not None:
                row.role = role.value
            if active is not None:
                row.active = active
            if password_hash is not None:
                row.password_hash = password_hash
            if salt is not None:
                row.salt = salt
            await session.commit()
            reloaded = await self._load(session, user_id)
            assert reloaded is not None
            return _to_user(reloaded)

    async def set_areas(self, user_id: uuid.UUID, area_ids: list[uuid.UUID]) -> None:
        async with self._sf() as session:
            await session.execute(delete(user_areas).where(user_areas.c.user_id == user_id))
            if area_ids:
                await session.execute(
                    insert(user_areas),
                    [{"user_id": user_id, "area_id": aid} for aid in area_ids],
                )
            await session.commit()

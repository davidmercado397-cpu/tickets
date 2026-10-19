"""Repositorio de notificaciones internas (in-app) sobre PostgreSQL async."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.adapters.db_models import NotificationRow
from app.domain.models import Notification, NotificationType


def _to_notification(row: NotificationRow) -> Notification:
    return Notification(
        id=row.id,
        user_id=row.user_id,
        type=NotificationType(row.type),
        title=row.title,
        body=row.body,
        ticket_id=row.ticket_id,
        radicado=row.radicado,
        read=row.read,
        created_at=row.created_at,
    )


class SqlAlchemyNotificationRepository:
    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._sf = session_factory

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        type: NotificationType,
        title: str,
        body: str | None,
        ticket_id: uuid.UUID | None,
        radicado: str | None,
    ) -> Notification:
        async with self._sf() as session:
            row = NotificationRow(
                user_id=user_id,
                type=type.value,
                title=title,
                body=body,
                ticket_id=ticket_id,
                radicado=radicado,
                read=False,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return _to_notification(row)

    async def list_for_user(
        self, user_id: uuid.UUID, *, unread_only: bool = False, limit: int = 50
    ) -> list[Notification]:
        async with self._sf() as session:
            stmt = select(NotificationRow).where(NotificationRow.user_id == user_id)
            if unread_only:
                stmt = stmt.where(NotificationRow.read.is_(False))
            stmt = stmt.order_by(NotificationRow.created_at.desc()).limit(limit)
            rows = (await session.execute(stmt)).scalars().all()
            return [_to_notification(r) for r in rows]

    async def unread_count(self, user_id: uuid.UUID) -> int:
        async with self._sf() as session:
            return (
                await session.execute(
                    select(func.count())
                    .select_from(NotificationRow)
                    .where(
                        NotificationRow.user_id == user_id, NotificationRow.read.is_(False)
                    )
                )
            ).scalar_one()

    async def mark_read(self, user_id: uuid.UUID, notification_id: uuid.UUID) -> bool:
        async with self._sf() as session:
            result = await session.execute(
                update(NotificationRow)
                .where(
                    NotificationRow.id == notification_id,
                    NotificationRow.user_id == user_id,  # un usuario solo marca las suyas
                )
                .values(read=True)
            )
            await session.commit()
            return result.rowcount > 0

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        async with self._sf() as session:
            result = await session.execute(
                update(NotificationRow)
                .where(
                    NotificationRow.user_id == user_id, NotificationRow.read.is_(False)
                )
                .values(read=True)
            )
            await session.commit()
            return result.rowcount

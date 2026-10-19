from __future__ import annotations

import uuid
from datetime import date, datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import Ctx
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.modules.sla.calendar import Calendar, national_holidays
from app.modules.sla.models import PRIORITIES, BusinessCalendar, Holiday, SlaPolicy

DEFAULT_PRIORITY = "medium"


async def seed(session: AsyncSession, tenant_id: uuid.UUID) -> None:
    """Arranque: 15 días hábiles para todas las prioridades (la empresa los ajusta luego)."""
    for p in PRIORITIES:
        session.add(SlaPolicy(tenant_id=tenant_id, priority=p, target_value=15, unit="business_days"))
    session.add(BusinessCalendar(tenant_id=tenant_id))
    await session.flush()


async def list_policies(session: AsyncSession, tenant_id: uuid.UUID) -> list[SlaPolicy]:
    rows = (await session.execute(select(SlaPolicy).where(SlaPolicy.tenant_id == tenant_id))).scalars()
    order = {p: i for i, p in enumerate(PRIORITIES)}
    return sorted(rows, key=lambda r: order.get(r.priority, 99))


async def get_policy(session: AsyncSession, tenant_id: uuid.UUID, priority: str) -> SlaPolicy | None:
    stmt = select(SlaPolicy).where(SlaPolicy.tenant_id == tenant_id, SlaPolicy.priority == priority)
    return (await session.execute(stmt)).scalar_one_or_none()


async def upsert_policy(session: AsyncSession, ctx: Ctx, priority: str, data: dict) -> SlaPolicy:
    policy = await get_policy(session, ctx.tid, priority)
    if policy is None:
        policy = SlaPolicy(tenant_id=ctx.tid, priority=priority)
        session.add(policy)
    for key, value in data.items():
        setattr(policy, key, value)
    await session.commit()
    return policy


async def get_calendar_row(session: AsyncSession, tenant_id: uuid.UUID) -> BusinessCalendar:
    row = await session.get(BusinessCalendar, tenant_id)
    if row is None:
        row = BusinessCalendar(tenant_id=tenant_id)
        session.add(row)
        await session.flush()
    return row


def _hm(value: str) -> time:
    h, m = value.split(":")
    return time(int(h), int(m))


async def get_calendar(session: AsyncSession, tenant_id: uuid.UUID) -> Calendar:
    row = await get_calendar_row(session, tenant_id)
    custom = (await session.execute(select(Holiday.day).where(Holiday.tenant_id == tenant_id))).scalars()
    return Calendar(
        tz=row.timezone,
        workdays=frozenset(row.workdays or [0, 1, 2, 3, 4]),
        work_start=_hm(row.work_start),
        work_end=_hm(row.work_end),
        country=row.country,
        custom_holidays=frozenset(custom),
    )


async def update_calendar(session: AsyncSession, ctx: Ctx, data: dict) -> BusinessCalendar:
    try:
        ZoneInfo(data["timezone"])
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValidationError("Zona horaria inválida.") from exc
    if not set(data["workdays"]) <= set(range(7)):
        raise ValidationError("Días laborales inválidos (0=lunes … 6=domingo).")
    if _hm(data["work_start"]) >= _hm(data["work_end"]):
        raise ValidationError("La hora de inicio debe ser anterior a la de fin.")
    row = await get_calendar_row(session, ctx.tid)
    for key, value in data.items():
        setattr(row, key, value)
    await session.commit()
    return row


async def list_holidays(session: AsyncSession, ctx: Ctx, year: int) -> list[dict]:
    row = await get_calendar_row(session, ctx.tid)
    items: list[dict] = []
    if row.country:
        items += [
            {"id": None, "day": d, "name": n, "national": True}
            for d, n in sorted(national_holidays(row.country, year).items())
        ]
    custom = (
        await session.execute(
            select(Holiday).where(
                Holiday.tenant_id == ctx.tid, Holiday.day >= date(year, 1, 1), Holiday.day <= date(year, 12, 31)
            )
        )
    ).scalars()
    items += [{"id": h.id, "day": h.day, "name": h.name, "national": False} for h in custom]
    return sorted(items, key=lambda i: i["day"])


async def add_holiday(session: AsyncSession, ctx: Ctx, day: date, name: str) -> Holiday:
    if (await session.execute(select(Holiday.id).where(Holiday.tenant_id == ctx.tid, Holiday.day == day))).first():
        raise ConflictError("Ya existe un festivo propio en esa fecha.")
    h = Holiday(tenant_id=ctx.tid, day=day, name=name)
    session.add(h)
    await session.commit()
    return h


async def delete_holiday(session: AsyncSession, ctx: Ctx, holiday_id: uuid.UUID) -> None:
    h = await session.get(Holiday, holiday_id)
    if h is None or h.tenant_id != ctx.tid:
        raise NotFoundError("Festivo no encontrado.")
    await session.delete(h)
    await session.commit()


async def compute_due(
    session: AsyncSession, tenant_id: uuid.UUID, priority: str | None, start: datetime
) -> tuple[datetime | None, dict]:
    """Vencimiento + copia de la política aplicada (se guarda en el caso: cambios futuros no lo afectan)."""
    policy = await get_policy(session, tenant_id, priority or DEFAULT_PRIORITY)
    if policy is None:
        return None, {}
    cal = await get_calendar(session, tenant_id)
    snapshot = {
        "priority": policy.priority,
        "target_value": policy.target_value,
        "unit": policy.unit,
        "pause_on_hold": policy.pause_on_hold,
        "warning_percent": policy.warning_percent,
    }
    return cal.add(start, policy.target_value, policy.unit), snapshot

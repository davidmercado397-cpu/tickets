from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.context import Ctx
from app.modules.identity.public import SessionDep, TenantCtxDep, require
from app.modules.sla import service
from app.modules.sla.schemas import (
    CalendarIn,
    CalendarOut,
    HolidayIn,
    HolidayOut,
    PolicyIn,
    PolicyOut,
    Priority,
    SimulateOut,
)

router = APIRouter(prefix="/sla", tags=["SLA"])
ManageSla = Annotated[Ctx, Depends(require("sla.manage"))]


@router.get("/policies", response_model=list[PolicyOut])
async def list_policies(ctx: TenantCtxDep, session: SessionDep) -> list[PolicyOut]:
    return [PolicyOut.model_validate(p) for p in await service.list_policies(session, ctx.tid)]


@router.put("/policies/{priority}", response_model=PolicyOut)
async def put_policy(priority: Priority, body: PolicyIn, ctx: ManageSla, session: SessionDep) -> PolicyOut:
    return PolicyOut.model_validate(await service.upsert_policy(session, ctx, priority, body.model_dump()))


@router.get("/calendar", response_model=CalendarOut)
async def get_calendar(ctx: TenantCtxDep, session: SessionDep) -> CalendarOut:
    row = await service.get_calendar_row(session, ctx.tid)
    await session.commit()
    return CalendarOut.model_validate(row)


@router.put("/calendar", response_model=CalendarOut)
async def put_calendar(body: CalendarIn, ctx: ManageSla, session: SessionDep) -> CalendarOut:
    return CalendarOut.model_validate(await service.update_calendar(session, ctx, body.model_dump()))


@router.get("/holidays", response_model=list[HolidayOut])
async def holidays(ctx: TenantCtxDep, session: SessionDep, year: int | None = None) -> list[HolidayOut]:
    items = await service.list_holidays(session, ctx, year or date.today().year)
    return [HolidayOut(**i) for i in items]


@router.post("/holidays", response_model=HolidayOut, status_code=status.HTTP_201_CREATED)
async def add_holiday(body: HolidayIn, ctx: ManageSla, session: SessionDep) -> HolidayOut:
    return HolidayOut.model_validate(await service.add_holiday(session, ctx, body.day, body.name))


@router.delete("/holidays/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holiday(holiday_id: uuid.UUID, ctx: ManageSla, session: SessionDep) -> None:
    await service.delete_holiday(session, ctx, holiday_id)


@router.get("/simulate", response_model=SimulateOut)
async def simulate(
    priority: Priority, ctx: TenantCtxDep, session: SessionDep, start: datetime | None = None
) -> SimulateOut:
    """Calcula el vencimiento que tendría un caso radicado ahora (o en `start`)."""
    start = start or datetime.now(timezone.utc)
    due, _ = await service.compute_due(session, ctx.tid, priority, start)
    return SimulateOut(priority=priority, start=start, due_at=due or start)

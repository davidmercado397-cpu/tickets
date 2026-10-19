from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response

from app.core.context import Ctx
from app.modules.identity.public import SessionDep, require
from app.modules.reports import exporters, service
from app.modules.tenancy.public import get_tenant_info

router = APIRouter(prefix="/reports", tags=["reportes"])
ViewReports = Annotated[Ctx, Depends(require("reports.view"))]
ExportReports = Annotated[Ctx, Depends(require("reports.export"))]


def _filters(date_from, date_to, segment, area_id, client_id, request_type_id) -> dict:
    return {"from": date_from, "to": date_to, "segment": segment, "area_id": area_id, "client_id": client_id,
            "request_type_id": request_type_id}


@router.get("/dashboard")
async def dashboard(ctx: ViewReports, session: SessionDep) -> dict[str, Any]:
    return await service.dashboard(session, ctx.tid)


@router.get("/pqrs")
async def pqrs_report(
    ctx: ViewReports,
    session: SessionDep,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    segment: str | None = None,
    area_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    request_type_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    f = _filters(date_from, date_to, segment, area_id, client_id, request_type_id)
    return await service.pqrs_summary(session, ctx.tid, f)


@router.get("/pqrs/export.xlsx")
async def pqrs_xlsx(
    ctx: ExportReports,
    session: SessionDep,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    segment: str | None = None,
    area_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    request_type_id: uuid.UUID | None = None,
) -> Response:
    f = _filters(date_from, date_to, segment, area_id, client_id, request_type_id)
    header, rows = await service.export_rows(session, ctx.tid, f)
    tenant = await get_tenant_info(session, ctx.tid)
    data = exporters.to_xlsx("PQRS", header, rows, tenant["primary_color"])
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="pqrs_{date.today()}.xlsx"'})


@router.get("/pqrs/summary.pdf")
async def pqrs_pdf(
    ctx: ExportReports,
    session: SessionDep,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    segment: str | None = None,
    area_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    request_type_id: uuid.UUID | None = None,
) -> Response:
    f = _filters(date_from, date_to, segment, area_id, client_id, request_type_id)
    summary = await service.pqrs_summary(session, ctx.tid, f)
    tenant = await get_tenant_info(session, ctx.tid)
    period = f"{date_from:%Y-%m-%d}" if date_from else "inicio"
    period += f" a {date_to:%Y-%m-%d}" if date_to else " a hoy"
    return Response(exporters.summary_pdf(tenant, summary, period), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="informe_pqrs_{date.today()}.pdf"'})


@router.get("/visits")
async def visits_report(ctx: ViewReports, session: SessionDep, month: str | None = None) -> dict[str, Any]:
    return await service.visits_summary(session, ctx.tid, month or date.today().strftime("%Y-%m"))


@router.get("/visits/export.xlsx")
async def visits_xlsx(ctx: ExportReports, session: SessionDep, month: str | None = None) -> Response:
    month = month or date.today().strftime("%Y-%m")
    summary = await service.visits_summary(session, ctx.tid, month)
    header = ["Nivel", "Cliente", "Sede", "Meta", "Realizadas", "% cumplimiento"]
    rows = [["Sede" if r["level"] == "site" else "Cliente", (r["client"] or {}).get("name", ""),
             (r["site"] or {}).get("name", ""), r["required"], r["done"], r["percent"]]
            for r in summary["compliance"]["rows"]]
    tenant = await get_tenant_info(session, ctx.tid)
    return Response(exporters.to_xlsx(f"Visitas {month}", header, rows, tenant["primary_color"]),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="visitas_{month}.xlsx"'})


@router.get("/tasks")
async def tasks_report(ctx: ViewReports, session: SessionDep) -> dict[str, Any]:
    return await service.tasks_summary(session, ctx.tid)

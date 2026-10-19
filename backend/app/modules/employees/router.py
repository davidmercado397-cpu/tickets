from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status

from app.core.context import Ctx
from app.modules.employees import service
from app.modules.employees.schemas import EmployeeIn, EmployeeOut, EmployeePage, EmployeeUpdate, ImportResult
from app.modules.identity.public import SessionDep, require

router = APIRouter(prefix="/employees", tags=["empleados"])
ViewEmployees = Annotated[Ctx, Depends(require("employees.view", "employees.manage"))]
ManageEmployees = Annotated[Ctx, Depends(require("employees.manage"))]


@router.get("", response_model=EmployeePage)
async def list_employees(
    ctx: ViewEmployees,
    session: SessionDep,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
) -> EmployeePage:
    items, total = await service.list_employees(session, ctx, q, page, page_size)
    return EmployeePage(items=[EmployeeOut.model_validate(e) for e in items], total=total, page=page, page_size=page_size)


@router.get("/import-template")
async def import_template(_: ManageEmployees) -> Response:
    header = ";".join(service.CSV_COLUMNS)
    sample = "1144000000;CC;Juan Pérez Gómez;juan@correo.com;3001234567;Vigilante;2024-02-01;Término fijo;activo"
    return Response(
        f"{header}\n{sample}\n".encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="plantilla_empleados.csv"'},
    )


@router.post("/import", response_model=ImportResult)
async def import_employees(ctx: ManageEmployees, session: SessionDep, file: UploadFile = File(...)) -> ImportResult:
    return ImportResult(**await service.import_csv(session, ctx, await file.read()))


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(body: EmployeeIn, ctx: ManageEmployees, session: SessionDep) -> EmployeeOut:
    return EmployeeOut.model_validate(await service.create_employee(session, ctx, body.model_dump()))


@router.get("/{employee_id}", response_model=EmployeeOut)
async def get_employee(employee_id: uuid.UUID, ctx: ViewEmployees, session: SessionDep) -> EmployeeOut:
    return EmployeeOut.model_validate(await service.get_employee(session, ctx.tid, employee_id))


@router.patch("/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: uuid.UUID, body: EmployeeUpdate, ctx: ManageEmployees, session: SessionDep
) -> EmployeeOut:
    emp = await service.update_employee(session, ctx, employee_id, body.model_dump(exclude_unset=True))
    return EmployeeOut.model_validate(emp)

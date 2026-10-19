"""Router de /employees.

- `GET /employees/{document}`: lo consume el **bot** (flujos de certificado/incapacidad) y el front →
  `require_caller`. Es el endpoint del contrato.
- Gestión (POST/GET lista/PATCH): **admin o service** (`require_privileged`). El `document` es la clave
  y no se edita."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

from app.api.schemas import (
    EmployeeCreateIn,
    EmployeeOut,
    EmployeePageOut,
    EmployeeUpdateIn,
    to_employee_out,
)
from app.dependencies import EmployeeServiceDep, require_caller, require_privileged

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get(
    "", summary="Listar empleados (admin)", dependencies=[Depends(require_privileged)]
)
async def list_employees(
    service: EmployeeServiceDep,
    q: str | None = Query(default=None, description="Busca por documento o nombre."),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> EmployeePageOut:
    items, total = await service.list(q=q, page=page, page_size=page_size)
    return EmployeePageOut(
        items=[to_employee_out(e) for e in items], total=total, page=page, page_size=page_size
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Crear empleado (admin)",
    dependencies=[Depends(require_privileged)],
)
async def create_employee(body: EmployeeCreateIn, service: EmployeeServiceDep) -> EmployeeOut:
    emp = await service.create(
        document=body.document,
        full_name=body.full_name,
        position=body.position,
        hire_date=body.hire_date,
        contract_type=body.contract_type,
        status=body.status,
        data=body.data,
    )
    return to_employee_out(emp)


@router.get(
    "/{document}",
    summary="Consultar empleado por documento (bot/flujos)",
    dependencies=[Depends(require_caller)],
)
async def get_employee(document: str, service: EmployeeServiceDep) -> EmployeeOut:
    return to_employee_out(await service.get(document))


@router.patch(
    "/{document}",
    summary="Actualizar empleado (admin)",
    dependencies=[Depends(require_privileged)],
)
async def update_employee(
    document: str, body: EmployeeUpdateIn, service: EmployeeServiceDep
) -> EmployeeOut:
    emp = await service.update(
        document,
        full_name=body.full_name,
        position=body.position,
        hire_date=body.hire_date,
        contract_type=body.contract_type,
        status=body.status,
        data=body.data,
    )
    return to_employee_out(emp)

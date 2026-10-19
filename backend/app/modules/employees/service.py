from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import Ctx
from app.core.errors import ConflictError, NotFoundError
from app.modules.clients.public import validate_client_site
from app.modules.employees.models import Employee


def normalize_document(doc: str) -> str:
    return re.sub(r"[^0-9A-Za-z]", "", doc).upper()


async def list_employees(
    session: AsyncSession, ctx: Ctx, q: str | None, page: int, page_size: int
) -> tuple[list[Employee], int]:
    stmt = select(Employee).where(Employee.tenant_id == ctx.tid)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Employee.full_name.ilike(like), Employee.document.ilike(like)))
    total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = await session.execute(stmt.order_by(Employee.full_name).offset((page - 1) * page_size).limit(page_size))
    return list(rows.scalars()), total


async def get_employee(session: AsyncSession, tenant_id: uuid.UUID, employee_id: uuid.UUID) -> Employee:
    emp = await session.get(Employee, employee_id)
    if emp is None or emp.tenant_id != tenant_id:
        raise NotFoundError("Empleado no encontrado.")
    return emp


async def find_by_document(session: AsyncSession, tenant_id: uuid.UUID, document: str) -> Employee | None:
    stmt = select(Employee).where(Employee.tenant_id == tenant_id, Employee.document == normalize_document(document))
    return (await session.execute(stmt)).scalar_one_or_none()


async def create_employee(session: AsyncSession, ctx: Ctx, data: dict) -> Employee:
    data["document"] = normalize_document(data["document"])
    if await find_by_document(session, ctx.tid, data["document"]):
        raise ConflictError("Ya existe un empleado con ese documento.")
    if data.get("site_id"):
        await validate_client_site(session, ctx.tid, None, data["site_id"])
    emp = Employee(tenant_id=ctx.tid, **data)
    session.add(emp)
    await session.commit()
    return emp


async def update_employee(session: AsyncSession, ctx: Ctx, employee_id: uuid.UUID, data: dict) -> Employee:
    emp = await get_employee(session, ctx.tid, employee_id)
    if data.get("site_id"):
        await validate_client_site(session, ctx.tid, None, data["site_id"])
    for key, value in data.items():
        setattr(emp, key, value)
    await session.commit()
    return emp


CSV_COLUMNS = ["documento", "tipo_documento", "nombre", "correo", "telefono", "cargo", "fecha_ingreso", "tipo_contrato", "estado"]


async def import_csv(session: AsyncSession, ctx: Ctx, content: bytes) -> dict:
    """Importa/actualiza empleados desde CSV (separador , o ;). Columnas: ver CSV_COLUMNS."""
    text = content.decode("utf-8-sig", errors="replace")
    dialect = csv.Sniffer().sniff(text.splitlines()[0] if text else ",", delimiters=",;")
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    created = updated = 0
    errors: list[str] = []
    for i, row in enumerate(reader, start=2):
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
        doc, name = normalize_document(row.get("documento", "")), row.get("nombre", "")
        if not doc or not name:
            errors.append(f"Fila {i}: documento y nombre son obligatorios.")
            continue
        try:
            hire = date.fromisoformat(row["fecha_ingreso"]) if row.get("fecha_ingreso") else None
        except ValueError:
            errors.append(f"Fila {i}: fecha_ingreso debe ser AAAA-MM-DD.")
            continue
        values = {
            "document_type": (row.get("tipo_documento") or "CC").upper()[:5],
            "full_name": name,
            "email": row.get("correo") or None,
            "phone": row.get("telefono") or None,
            "position": row.get("cargo") or None,
            "hire_date": hire,
            "contract_type": row.get("tipo_contrato") or None,
            "status": "retired" if row.get("estado", "").lower() in {"retirado", "retired", "inactivo"} else "active",
        }
        emp = await find_by_document(session, ctx.tid, doc)
        if emp is None:
            session.add(Employee(tenant_id=ctx.tid, document=doc, **values))
            created += 1
        else:
            for k, v in values.items():
                setattr(emp, k, v)
            updated += 1
        await session.flush()
    await session.commit()
    return {"created": created, "updated": updated, "errors": errors[:50]}

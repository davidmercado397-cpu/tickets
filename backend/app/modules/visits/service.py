"""Visitas a puesto: formularios dinámicos, metas mensuales, diligenciamiento, hallazgos y cumplimiento."""

from __future__ import annotations

import base64
import uuid
from datetime import date, datetime, time, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.context import Ctx
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.core.events import commit_and_dispatch, emit
from app.core.storage import new_key, storage
from app.modules.clients import public as clients
from app.modules.sla import public as sla
from app.modules.tasks import public as tasks
from app.modules.visits.models import Visit, VisitFile, VisitForm, VisitQuota
from app.modules.visits.schemas import FormField
from app.modules.visits.seed_data import DEFAULT_FORM


async def seed(session: AsyncSession, tenant_id: uuid.UUID) -> None:
    fields = [FormField(**f).model_dump(mode="json") for f in DEFAULT_FORM["fields"]]
    session.add(VisitForm(tenant_id=tenant_id, name=DEFAULT_FORM["name"], description=DEFAULT_FORM["description"],
                          fields=fields))
    await session.flush()


# --- Formularios ---

async def list_forms(session: AsyncSession, ctx: Ctx, only_active: bool = False) -> list[VisitForm]:
    stmt = select(VisitForm).where(VisitForm.tenant_id == ctx.tid).order_by(VisitForm.name)
    if only_active:
        stmt = stmt.where(VisitForm.active.is_(True))
    return list((await session.execute(stmt)).scalars())


async def get_form(session: AsyncSession, ctx: Ctx, form_id: uuid.UUID) -> VisitForm:
    form = await session.get(VisitForm, form_id)
    if form is None or form.tenant_id != ctx.tid:
        raise NotFoundError("Formulario no encontrado.")
    return form


async def create_form(session: AsyncSession, ctx: Ctx, data: dict) -> VisitForm:
    form = VisitForm(tenant_id=ctx.tid, **data)
    session.add(form)
    await session.commit()
    return form


async def update_form(session: AsyncSession, ctx: Ctx, form_id: uuid.UUID, data: dict) -> VisitForm:
    form = await get_form(session, ctx, form_id)
    if data["fields"] != form.fields:
        form.version += 1  # las visitas ya hechas conservan su copia del formulario
    for key, value in data.items():
        setattr(form, key, value)
    await session.commit()
    return form


# --- Metas ---

async def list_quotas(session: AsyncSession, ctx: Ctx) -> list[VisitQuota]:
    return list((await session.execute(select(VisitQuota).where(VisitQuota.tenant_id == ctx.tid))).scalars())


async def upsert_quota(session: AsyncSession, ctx: Ctx, data: dict) -> VisitQuota:
    client_id, site_id = data.get("client_id"), data.get("site_id")
    if site_id:
        _, site_id = await clients.validate_client_site(session, ctx.tid, None, site_id)
    else:
        await clients.validate_client_site(session, ctx.tid, client_id, None)
    if data.get("form_id"):
        await get_form(session, ctx, data["form_id"])
    stmt = select(VisitQuota).where(VisitQuota.tenant_id == ctx.tid)
    stmt = stmt.where(VisitQuota.site_id == site_id) if site_id else stmt.where(
        VisitQuota.client_id == client_id, VisitQuota.site_id.is_(None))
    quota = (await session.execute(stmt)).scalar_one_or_none()
    if quota is None:
        quota = VisitQuota(tenant_id=ctx.tid, client_id=None if site_id else client_id, site_id=site_id,
                           visits_per_month=0)
        session.add(quota)
    quota.visits_per_month = data["visits_per_month"]
    quota.form_id = data.get("form_id")
    quota.active = data.get("active", True)
    await session.commit()
    return quota


async def delete_quota(session: AsyncSession, ctx: Ctx, quota_id: uuid.UUID) -> None:
    q = await session.get(VisitQuota, quota_id)
    if q is None or q.tenant_id != ctx.tid:
        raise NotFoundError("Meta no encontrada.")
    await session.delete(q)
    await session.commit()


# --- Visitas ---

def _scope_all(ctx: Ctx) -> bool:
    return ctx.can("visits.view_all") or ctx.can("visits.manage") or bool(ctx.integration)


async def get_visit(session: AsyncSession, ctx: Ctx, visit_id: uuid.UUID) -> Visit:
    v = await session.get(Visit, visit_id)
    if v is None or v.tenant_id != ctx.tid or (not _scope_all(ctx) and v.visitor_id != ctx.user_id):
        raise NotFoundError("Visita no encontrada.")
    return v


async def start_visit(session: AsyncSession, ctx: Ctx, data: dict) -> Visit:
    form = await get_form(session, ctx, data["form_id"])
    if not form.active:
        raise ValidationError("El formulario está inactivo.")
    client_id, site_id = await clients.validate_client_site(session, ctx.tid, None, data["site_id"])
    v = Visit(
        tenant_id=ctx.tid, form_id=form.id, form_version=form.version,
        form_snapshot={"name": form.name, "fields": form.fields},
        client_id=client_id, site_id=site_id, visitor_id=ctx.user_id,
        latitude=data.get("latitude"), longitude=data.get("longitude"),
    )
    session.add(v)
    await session.commit()
    return v


def _own_draft(ctx: Ctx, v: Visit) -> None:
    if v.visitor_id != ctx.user_id:
        raise ForbiddenError("Solo quien realiza la visita puede diligenciarla.")
    if v.status != "draft":
        raise ValidationError("La visita ya fue cerrada.")


def _fields(v: Visit) -> list[FormField]:
    return [FormField(**f) for f in (v.form_snapshot or {}).get("fields", [])]


def _clean(field: FormField, value: Any, file_ids: set[str]) -> Any:
    """Valida y normaliza una respuesta según el tipo del campo."""
    if value in (None, "", []):
        return None
    t = field.type
    if t in ("text", "textarea"):
        return str(value)[:20000]
    if t == "yesno":
        if value not in ("yes", "no", "na"):
            raise ValidationError(f"'{field.label}': responde sí, no o no aplica.")
        return value
    if t in ("number", "rating"):
        try:
            num = float(value)
        except (TypeError, ValueError) as exc:
            raise ValidationError(f"'{field.label}' debe ser numérico.") from exc
        if (field.min is not None and num < field.min) or (field.max is not None and num > field.max):
            raise ValidationError(f"'{field.label}' está fuera del rango permitido.")
        return int(num) if t == "rating" else num
    if t == "select":
        if value not in field.options:
            raise ValidationError(f"'{field.label}': opción inválida.")
        return value
    if t == "multiselect":
        if not isinstance(value, list) or not set(value) <= set(field.options):
            raise ValidationError(f"'{field.label}': opciones inválidas.")
        return value
    if t == "date":
        try:
            return date.fromisoformat(str(value)).isoformat()
        except ValueError as exc:
            raise ValidationError(f"'{field.label}' debe ser una fecha.") from exc
    if t == "photo":
        ids = [str(i) for i in (value if isinstance(value, list) else [value])]
        if not set(ids) <= file_ids:
            raise ValidationError(f"'{field.label}': foto no encontrada.")
        return ids
    if t == "signature":
        if not (isinstance(value, str) and value.startswith("data:image/png;base64,")) or len(value) > 400_000:
            raise ValidationError(f"'{field.label}': firma inválida.")
        return value
    return None


async def _file_ids(session: AsyncSession, visit_id: uuid.UUID) -> set[str]:
    rows = await session.execute(select(VisitFile.id).where(VisitFile.visit_id == visit_id))
    return {str(r) for r in rows.scalars()}


async def save_answers(session: AsyncSession, ctx: Ctx, visit_id: uuid.UUID, answers: dict, observations: str | None) -> Visit:
    v = await get_visit(session, ctx, visit_id)
    _own_draft(ctx, v)
    file_ids = await _file_ids(session, v.id)
    by_id = {f.id: f for f in _fields(v)}
    clean = dict(v.answers or {})
    for key, value in answers.items():
        field = by_id.get(key)
        if field is None or field.type == "section":
            continue
        clean[key] = _clean(field, value, file_ids)
    v.answers = clean
    if observations is not None:
        v.observations = observations
    await session.commit()
    return v


async def add_file(session: AsyncSession, ctx: Ctx, visit_id: uuid.UUID, field_id: str, filename: str,
                   mime: str, data: bytes) -> VisitFile:
    v = await get_visit(session, ctx, visit_id)
    _own_draft(ctx, v)
    field = next((f for f in _fields(v) if f.id == field_id), None)
    if field is None or field.type != "photo":
        raise ValidationError("El campo no admite fotos.")
    if not mime.startswith("image/"):
        raise ValidationError("Solo se admiten imágenes.")
    if len(data) > get_settings().MAX_UPLOAD_MB * 1024 * 1024:
        raise ValidationError("La foto supera el tamaño máximo.")
    key = new_key(ctx.tid, f"visits/{v.id}", filename)
    await storage().put(key, data, mime)
    f = VisitFile(tenant_id=ctx.tid, visit_id=v.id, field_id=field_id, key=key, filename=filename[:200], mime=mime,
                  size=len(data))
    session.add(f)
    await session.flush()
    answers = dict(v.answers or {})
    answers[field_id] = [*(answers.get(field_id) or []), str(f.id)]
    v.answers = answers
    await session.commit()
    return f


def _is_finding(field: FormField, value: Any) -> bool:
    rule = field.finding
    if rule is None or value is None:
        return False
    try:
        if rule.op == "equals":
            return value == rule.value
        if rule.op == "not_equals":
            return value != rule.value
        if rule.op == "lte":
            return float(value) <= float(rule.value)
        if rule.op == "gte":
            return float(value) >= float(rule.value)
        if rule.op == "in":
            options = rule.value if isinstance(rule.value, list) else [rule.value]
            values = value if isinstance(value, list) else [value]
            return any(v in options for v in values)
    except (TypeError, ValueError):
        return False
    return False


def evaluate(fields: list[FormField], answers: dict) -> tuple[float | None, list[dict]]:
    """Puntaje 0–100 (sí/no y calificaciones) y lista de hallazgos con la tarea sugerida."""
    points: list[float] = []
    findings: list[dict] = []
    for f in fields:
        value = answers.get(f.id)
        if f.scored and value is not None:
            if f.type == "yesno" and value in ("yes", "no"):
                points.append(1.0 if value == "yes" else 0.0)
            elif f.type == "rating" and f.max and f.max > (f.min or 0):
                points.append((float(value) - (f.min or 0)) / (f.max - (f.min or 0)))
        if _is_finding(f, value):
            findings.append({
                "field_id": f.id, "label": f.label, "answer": value,
                "suggested_task": f.finding.task_title or f"Atender hallazgo: {f.label}",
                "priority": f.finding.priority,
            })
    score = round(sum(points) / len(points) * 100, 1) if points else None
    return score, findings


async def complete_visit(session: AsyncSession, ctx: Ctx, visit_id: uuid.UUID, data: dict) -> Visit:
    v = await get_visit(session, ctx, visit_id)
    _own_draft(ctx, v)
    if data.get("answers") or data.get("observations") is not None:
        await save_answers(session, ctx, visit_id, data.get("answers") or {}, data.get("observations"))
    fields = _fields(v)
    missing = [f.label for f in fields if f.required and f.type != "section" and v.answers.get(f.id) in (None, "", [])]
    if missing:
        raise ValidationError("Faltan respuestas obligatorias: " + "; ".join(missing[:5]))
    v.score, v.findings = evaluate(fields, v.answers or {})
    v.status, v.completed_at = "completed", datetime.now(timezone.utc)
    if data.get("latitude") is not None:
        v.latitude, v.longitude = data["latitude"], data.get("longitude")
    site_names = (await clients.names(session, ctx.tid))["sites"]
    site_name = site_names.get(v.site_id, "")
    for t in data.get("tasks") or []:
        await tasks.create_task(session, ctx, {
            "title": t["title"], "description": t.get("description"), "assignee_id": t.get("assignee_id"),
            "due_date": t.get("due_date"), "priority": t.get("priority", "medium"),
            "client_id": v.client_id, "site_id": v.site_id, "source_type": "visit", "source_id": v.id,
            "source_label": f"Visita {site_name} {v.completed_at:%d/%m/%Y}",
        }, commit=False)
    emit(session, "visit.completed", ctx.tid, visit_id=v.id, findings=len(v.findings), site_name=site_name,
         visitor_name=ctx.actor_label, by=ctx.user_id)
    await commit_and_dispatch(session)
    return v


async def delete_draft(session: AsyncSession, ctx: Ctx, visit_id: uuid.UUID) -> None:
    v = await get_visit(session, ctx, visit_id)
    _own_draft(ctx, v)
    await session.delete(v)
    await session.commit()


async def list_visits(session: AsyncSession, ctx: Ctx, f: dict, page: int, page_size: int) -> tuple[list[Visit], int]:
    stmt = select(Visit).where(Visit.tenant_id == ctx.tid)
    if not _scope_all(ctx) or f.get("mine"):
        stmt = stmt.where(Visit.visitor_id == ctx.user_id)
    for col in ("client_id", "site_id", "visitor_id", "status", "form_id"):
        if f.get(col):
            stmt = stmt.where(getattr(Visit, col) == f[col])
    if f.get("month"):
        start, end = await month_range(session, ctx.tid, f["month"])
        stmt = stmt.where(Visit.completed_at >= start, Visit.completed_at < end)
    total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = await session.execute(stmt.order_by(Visit.started_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return list(rows.scalars()), total


async def month_range(session: AsyncSession, tenant_id: uuid.UUID, month: str) -> tuple[datetime, datetime]:
    try:
        year, mon = (int(x) for x in month.split("-"))
        first = date(year, mon, 1)
    except ValueError as exc:
        raise ValidationError("Mes inválido (usa AAAA-MM).") from exc
    nxt = date(year + (mon == 12), 1 if mon == 12 else mon + 1, 1)
    zone = (await sla.get_calendar(session, tenant_id)).zone
    return (datetime.combine(first, time(), tzinfo=zone).astimezone(timezone.utc),
            datetime.combine(nxt, time(), tzinfo=zone).astimezone(timezone.utc))


async def compliance(session: AsyncSession, tenant_id: uuid.UUID, month: str) -> dict:
    """Visitas realizadas vs meta del mes. Meta por sede → cuenta visitas de esa sede; meta por cliente →
    cuenta visitas a cualquiera de sus sedes."""
    start, end = await month_range(session, tenant_id, month)
    done_rows = await session.execute(
        select(Visit.client_id, Visit.site_id, func.count())
        .where(Visit.tenant_id == tenant_id, Visit.status == "completed", Visit.completed_at >= start,
               Visit.completed_at < end)
        .group_by(Visit.client_id, Visit.site_id)
    )
    by_site: dict[uuid.UUID, int] = {}
    by_client: dict[uuid.UUID, int] = {}
    for client_id, site_id, n in done_rows:
        by_site[site_id] = by_site.get(site_id, 0) + n
        by_client[client_id] = by_client.get(client_id, 0) + n
    quotas = (await session.execute(
        select(VisitQuota).where(VisitQuota.tenant_id == tenant_id, VisitQuota.active.is_(True),
                                 VisitQuota.visits_per_month > 0)
    )).scalars()
    names = await clients.names(session, tenant_id)
    site_clients = {s["id"]: s["client_id"] for s in await clients.active_sites(session, tenant_id)}
    rows, req_total, done_capped = [], 0, 0
    for q in quotas:
        if q.site_id:
            done = by_site.get(q.site_id, 0)
            client_id = site_clients.get(q.site_id)
        else:
            done = by_client.get(q.client_id, 0)
            client_id = q.client_id
        req_total += q.visits_per_month
        done_capped += min(done, q.visits_per_month)
        rows.append({
            "level": "site" if q.site_id else "client",
            "client": {"id": client_id, "name": names["clients"].get(client_id, "—")} if client_id else None,
            "site": {"id": q.site_id, "name": names["sites"].get(q.site_id, "—")} if q.site_id else None,
            "required": q.visits_per_month,
            "done": done,
            "percent": round(min(done / q.visits_per_month, 1) * 100, 1),
        })
    rows.sort(key=lambda r: r["percent"])
    return {"month": month, "required": req_total, "done_capped": done_capped,
            "percent": round(done_capped / req_total * 100, 1) if req_total else 0.0, "rows": rows}


def signature_png(data_url: str) -> bytes:
    return base64.b64decode(data_url.split(",", 1)[1])

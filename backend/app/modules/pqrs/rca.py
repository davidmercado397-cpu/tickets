"""Análisis de causa raíz (RCA) obligatorio para ciertas PQRS (por defecto: queja de cliente externo).

Flujo liderado por Calidad (permiso `pqrs.rca_manage`):
  setup       Calidad redacta el problema, elige el método y marca las áreas que intervienen.
  analysis    Cada área participante aporta su análisis (permiso `pqrs.rca_contribute` + pertenecer al área).
  validation  Calidad consolidó la causa raíz y decide si se requiere plan de acción.
  plan        Calidad registra las acciones (cada una es una tarea con responsable y fecha) y cierra el plan.
  closed      Documentación completa: la queja ya puede responderse y cerrarse.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import Ctx
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.core.events import commit_and_dispatch, emit
from app.modules.identity import public as identity
from app.modules.pqrs.models import FINAL_STATUSES, Pqrs, PqrsEvent, RcaParticipant, RootCauseAnalysis
from app.modules.tasks import public as tasks
from app.modules.tenancy import public as tenancy

ACTION_SOURCE = "action_plan"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def quality_area_id(session: AsyncSession, tenant_id: uuid.UUID) -> uuid.UUID | None:
    """Área configurada como Calidad en la empresa; si no, la de código `calidad`."""
    tenant = await tenancy.get_tenant_info(session, tenant_id)
    configured = (tenant["settings"].get("quality") or {}).get("area_id")
    if configured:
        area = await identity.area_brief(session, tenant_id, uuid.UUID(str(configured)))
        if area:
            return area["id"]
    return await identity.area_id_by_code(session, tenant_id, "calidad")


async def get_for(session: AsyncSession, pqrs_id: uuid.UUID) -> RootCauseAnalysis | None:
    stmt = select(RootCauseAnalysis).where(RootCauseAnalysis.pqrs_id == pqrs_id).execution_options(
        populate_existing=True
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def start(session: AsyncSession, p: Pqrs, ctx: Ctx | None) -> None:
    """Activa el RCA en el caso: lo enruta a Calidad y crea el análisis en estado `setup`."""
    p.requires_rca = True
    existing = await get_for(session, p.id)
    if existing is None:
        session.add(RootCauseAnalysis(tenant_id=p.tenant_id, pqrs_id=p.id, problem_statement=p.description))
    p.rca_status = existing.status if existing else "setup"
    area = await quality_area_id(session, p.tenant_id)
    if area and p.area_id != area:
        p.area_id = area
    session.add(_event(p, ctx, "rca_required", "Requiere análisis de causa raíz. Se envía a Calidad."))
    emit(session, "pqrs.rca_required", p.tenant_id, pqrs_id=p.id)


def _event(p: Pqrs, ctx: Ctx | None, kind: str, note: str | None, data: dict | None = None) -> PqrsEvent:
    return PqrsEvent(pqrs_id=p.id, kind=kind, note=note, internal=True, data=data or {}, at=_now(),
                     actor_id=ctx.user_id if ctx else None, actor_label=ctx.actor_label if ctx else "Sistema")


def ensure_can_respond(p: Pqrs) -> None:
    """La respuesta formal (y el cierre) exige el RCA cerrado."""
    if p.requires_rca and p.rca_status != "closed":
        raise ValidationError(
            "Esta PQRS exige análisis de causa raíz: Calidad debe cerrarlo (y su plan de acción, si aplica) "
            "antes de responder."
        )


async def _load(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID) -> tuple[Pqrs, RootCauseAnalysis]:
    from app.modules.pqrs.service import get_pqrs  # evita import circular

    p = await get_pqrs(session, ctx, pqrs_id, full=False)
    rca = await get_for(session, p.id)
    if not p.requires_rca or rca is None:
        raise NotFoundError("Esta PQRS no tiene análisis de causa raíz.")
    return p, rca


def _require_manage(ctx: Ctx) -> None:
    if not ctx.can("pqrs.rca_manage"):
        raise ForbiddenError("Solo Calidad (permiso de gestionar causa raíz) puede hacer este paso.")


def _require_status(rca: RootCauseAnalysis, *allowed: str) -> None:
    if rca.status not in allowed:
        raise ValidationError(f"El análisis está en la etapa '{rca.status}'; este paso no aplica.")


def _sync(p: Pqrs, rca: RootCauseAnalysis) -> None:
    p.rca_status = rca.status


async def get(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID) -> tuple[Pqrs, RootCauseAnalysis]:
    return await _load(session, ctx, pqrs_id)


async def setup(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, data: dict) -> RootCauseAnalysis:
    p, rca = await _load(session, ctx, pqrs_id)
    _require_manage(ctx)
    _require_status(rca, "setup", "analysis")
    if p.status in FINAL_STATUSES:
        raise ValidationError("El caso ya está cerrado.")
    area_ids = list(dict.fromkeys(data["area_ids"]))
    for a in area_ids:
        if await identity.area_brief(session, ctx.tid, a) is None:
            raise ValidationError("Alguna de las áreas no existe.")
    current = {pt.area_id: pt for pt in rca.participants}
    new_areas = [a for a in area_ids if a not in current]
    rca.participants = [current.get(a) or RcaParticipant(area_id=a) for a in area_ids]
    rca.method = data["method"]
    rca.problem_statement = data["problem_statement"].strip()
    rca.status = "analysis"
    _sync(p, rca)
    names = await identity.area_names(session, ctx.tid)
    session.add(_event(p, ctx, "rca_setup", rca.problem_statement,
                       {"areas": [names.get(a, "—") for a in area_ids], "method": rca.method}))
    if new_areas:
        emit(session, "pqrs.rca_participants", ctx.tid, pqrs_id=p.id, area_ids=[str(a) for a in new_areas])
    await commit_and_dispatch(session)
    return await get_for(session, p.id)  # type: ignore[return-value]


async def contribute(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, area_id: uuid.UUID, data: dict) -> RootCauseAnalysis:
    p, rca = await _load(session, ctx, pqrs_id)
    _require_status(rca, "analysis")
    part = next((pt for pt in rca.participants if pt.area_id == area_id), None)
    if part is None:
        raise ValidationError("Esa área no participa en el análisis.")
    if not (ctx.can("pqrs.rca_manage") or (ctx.can("pqrs.rca_contribute") and area_id in ctx.area_ids)):
        raise ForbiddenError("Solo los miembros del área (o Calidad) pueden registrar su análisis.")
    whys = [w.strip() for w in data.get("whys") or [] if w and w.strip()]
    if rca.method == "five_whys" and not whys:
        raise ValidationError("Responde al menos el primer '¿por qué?'.")
    part.analysis = data["analysis"].strip()
    part.whys = whys
    part.contributed_by, part.contributed_by_label, part.contributed_at = ctx.user_id, ctx.actor_label, _now()
    names = await identity.area_names(session, ctx.tid)
    session.add(_event(p, ctx, "rca_contribution", part.analysis, {"area": names.get(area_id, "—")}))
    emit(session, "pqrs.rca_contributed", ctx.tid, pqrs_id=p.id, area_name=names.get(area_id, "—"),
         pending=sum(1 for pt in rca.participants if pt.contributed_at is None))
    await commit_and_dispatch(session)
    return await get_for(session, p.id)  # type: ignore[return-value]


async def consolidate(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, data: dict) -> RootCauseAnalysis:
    p, rca = await _load(session, ctx, pqrs_id)
    _require_manage(ctx)
    _require_status(rca, "analysis", "validation")
    pending = [pt for pt in rca.participants if pt.contributed_at is None]
    if pending:
        names = await identity.area_names(session, ctx.tid)
        raise ValidationError("Faltan aportes de: " + ", ".join(names.get(pt.area_id, "—") for pt in pending)
                              + ". Si un área ya no aplica, quítala de los participantes.")
    rca.root_cause = data["root_cause"].strip()
    rca.cause_category = data["cause_category"]
    rca.consolidated_at, rca.consolidated_by = _now(), ctx.actor_label
    rca.status = "validation"
    _sync(p, rca)
    session.add(_event(p, ctx, "rca_root_cause", rca.root_cause, {"category": rca.cause_category}))
    await commit_and_dispatch(session)
    return await get_for(session, p.id)  # type: ignore[return-value]


async def validate(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, data: dict) -> RootCauseAnalysis:
    p, rca = await _load(session, ctx, pqrs_id)
    _require_manage(ctx)
    _require_status(rca, "validation")
    rca.plan_required = bool(data["plan_required"])
    rca.validation_note = data["note"].strip()
    rca.validated_at, rca.validated_by = _now(), ctx.actor_label
    if rca.plan_required:
        rca.status = "plan"
        note = f"Calidad determinó que SÍ se requiere plan de acción. {rca.validation_note}"
    else:
        rca.status, rca.closed_at, rca.closed_by = "closed", _now(), ctx.actor_label
        note = f"Calidad determinó que NO se requiere plan de acción. {rca.validation_note}"
    _sync(p, rca)
    session.add(_event(p, ctx, "rca_validated", note, {"plan_required": rca.plan_required}))
    if rca.status == "closed":
        emit(session, "pqrs.rca_closed", ctx.tid, pqrs_id=p.id)
    await commit_and_dispatch(session)
    return await get_for(session, p.id)  # type: ignore[return-value]


async def add_action(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, data: dict) -> RootCauseAnalysis:
    p, rca = await _load(session, ctx, pqrs_id)
    _require_manage(ctx)
    _require_status(rca, "plan")
    await tasks.create_task(session, ctx, {
        "title": data["title"], "description": data.get("description"), "assignee_id": data.get("assignee_id"),
        "due_date": data.get("due_date"), "priority": data.get("priority", "medium"),
        "client_id": p.client_id, "site_id": p.site_id,
        "source_type": ACTION_SOURCE, "source_id": p.id, "source_label": f"Plan de acción {p.radicado}",
    }, commit=False)
    session.add(_event(p, ctx, "rca_action", data["title"]))
    await commit_and_dispatch(session)
    return await get_for(session, p.id)  # type: ignore[return-value]


async def actions(session: AsyncSession, tenant_id: uuid.UUID, pqrs_id: uuid.UUID) -> list[dict]:
    return await tasks.tasks_for_source(session, tenant_id, ACTION_SOURCE, pqrs_id)


async def close_plan(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, summary: str | None) -> RootCauseAnalysis:
    p, rca = await _load(session, ctx, pqrs_id)
    _require_manage(ctx)
    _require_status(rca, "plan")
    if not await actions(session, ctx.tid, p.id):
        raise ValidationError("Registra al menos una acción del plan antes de cerrarlo.")
    rca.plan_summary = (summary or "").strip() or None
    rca.status, rca.closed_at, rca.closed_by = "closed", _now(), ctx.actor_label
    _sync(p, rca)
    session.add(_event(p, ctx, "rca_closed", rca.plan_summary or "Plan de acción definido; análisis cerrado."))
    emit(session, "pqrs.rca_closed", ctx.tid, pqrs_id=p.id)
    await commit_and_dispatch(session)
    return await get_for(session, p.id)  # type: ignore[return-value]


async def reopen(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, note: str) -> RootCauseAnalysis:
    """Calidad devuelve el análisis a la etapa de aportes (p. ej. si la validación revela otra causa)."""
    p, rca = await _load(session, ctx, pqrs_id)
    _require_manage(ctx)
    _require_status(rca, "validation", "plan", "closed")
    if p.status in FINAL_STATUSES:
        raise ValidationError("El caso ya está cerrado.")
    rca.status = "analysis"
    rca.plan_required, rca.closed_at, rca.closed_by = None, None, None
    _sync(p, rca)
    session.add(_event(p, ctx, "rca_reopened", note))
    await commit_and_dispatch(session)
    return await get_for(session, p.id)  # type: ignore[return-value]

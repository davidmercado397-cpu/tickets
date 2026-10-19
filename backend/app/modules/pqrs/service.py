"""Ciclo de vida de una PQRS: radicación, clasificación, gestión, pausa, respuesta y aprobación."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.context import Ctx
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.core.events import commit_and_dispatch, emit
from app.core.security import random_code
from app.core.storage import new_key, storage
from app.modules.catalog import public as catalog
from app.modules.clients import public as clients
from app.modules.employees import public as employees
from app.modules.identity import public as identity
from app.modules.pqrs.models import FINAL_STATUSES, Pqrs, PqrsAttachment, PqrsEvent, PqrsResponse
from app.modules.sla import public as sla
from app.modules.tenancy import public as tenancy

ALLOWED_MIME_PREFIXES = ("image/", "audio/", "video/")
ALLOWED_MIMES = {
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
}
MAX_FILES = 10

# Transiciones manuales permitidas (las de respuesta/aprobación las hace el flujo de respuesta).
TRANSITIONS = {
    "received": {"in_progress", "on_hold", "cancelled"},
    "assigned": {"in_progress", "on_hold", "cancelled", "received"},
    "in_progress": {"on_hold", "cancelled"},
    "on_hold": {"in_progress", "cancelled"},
    "pending_approval": {"cancelled"},
}


@dataclass
class UploadedFile:
    filename: str
    content_type: str
    data: bytes


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- Utilidades ---

def _check_files(files: list[UploadedFile]) -> None:
    max_bytes = get_settings().MAX_UPLOAD_MB * 1024 * 1024
    if len(files) > MAX_FILES:
        raise ValidationError(f"Máximo {MAX_FILES} archivos por envío.")
    for f in files:
        if len(f.data) > max_bytes:
            raise ValidationError(f"'{f.filename}' supera {get_settings().MAX_UPLOAD_MB} MB.")
        if not (f.content_type in ALLOWED_MIMES or f.content_type.startswith(ALLOWED_MIME_PREFIXES)):
            raise ValidationError(f"Tipo de archivo no permitido: {f.filename}")


async def _store_files(
    session: AsyncSession, p: Pqrs, files: list[UploadedFile], source: str, user_id: uuid.UUID | None, public: bool
) -> list[PqrsAttachment]:
    out = []
    for f in files:
        key = new_key(p.tenant_id, f"pqrs/{p.radicado}", f.filename)
        await storage().put(key, f.data, f.content_type)
        att = PqrsAttachment(
            tenant_id=p.tenant_id, pqrs_id=p.id, key=key, filename=f.filename[:200], mime=f.content_type,
            size=len(f.data), source=source, uploaded_by_id=user_id, public=public,
        )
        session.add(att)
        out.append(att)
    return out


def _event(p: Pqrs, ctx: Ctx | None, kind: str, *, note: str | None = None, internal: bool = True,
           to_status: str | None = None, from_status: str | None = None, data: dict | None = None,
           actor_label: str | None = None) -> PqrsEvent:
    ev = PqrsEvent(
        pqrs_id=p.id, kind=kind, note=note, internal=internal, to_status=to_status, from_status=from_status,
        actor_id=ctx.user_id if ctx else None,
        actor_label=actor_label or (ctx.actor_label if ctx else "Sistema"),
        data=data or {}, at=_now(),
    )
    return ev


def _warning_at(created: datetime, due: datetime | None, percent: int) -> datetime | None:
    if due is None:
        return None
    return created + (due - created) * (percent / 100)


async def _apply_sla(session: AsyncSession, p: Pqrs, *, refresh_policy: bool = False) -> None:
    """(Re)calcula el vencimiento desde la radicación, respetando las pausas registradas.

    Usa la política guardada en el caso (editar una política solo afecta a casos nuevos), salvo
    `refresh_policy` (alta del caso o cambio de prioridad)."""
    snapshot = dict(p.sla_policy or {})
    intervals = list(snapshot.get("pauses", []))
    cal = await sla.get_calendar(session, p.tenant_id)
    if refresh_policy or "unit" not in snapshot:
        due, policy = await sla.compute_due(session, p.tenant_id, p.priority, p.created_at)
    else:
        policy = snapshot
        due = cal.add(p.created_at, policy["target_value"], policy["unit"])
    if due is not None and intervals and policy.get("pause_on_hold"):
        for start, end in intervals:
            due = cal.extend(due, datetime.fromisoformat(start), datetime.fromisoformat(end), policy["unit"])
    policy = {**policy, "pauses": intervals}
    p.sla_policy = policy
    p.sla_due_at = due
    p.sla_warning_at = _warning_at(p.created_at, due, policy.get("warning_percent", 80))


async def _close_pause(session: AsyncSession, p: Pqrs, now: datetime) -> None:
    if p.paused_at is None:
        return
    policy = dict(p.sla_policy or {})
    policy["pauses"] = [*policy.get("pauses", []), [p.paused_at.isoformat(), now.isoformat()]]
    p.sla_policy = policy
    p.paused_at = None
    await _apply_sla(session, p)


def sla_state(p: Pqrs, now: datetime | None = None) -> str | None:
    if p.status == "cancelled":
        return None
    effective_now = p.paused_at or now or _now()
    return sla.sla_state(
        created_at=p.created_at,
        due_at=p.sla_due_at,
        resolved_at=p.resolved_at,
        now=effective_now,
        warning_percent=(p.sla_policy or {}).get("warning_percent", 80),
    )


def _mark_first_response(p: Pqrs) -> None:
    if p.first_response_at is None:
        p.first_response_at = _now()


# --- Consulta ---

def scope_condition(ctx: Ctx):
    """Qué PQRS puede ver quien llama."""
    if ctx.can("pqrs.view_all") or ctx.integration:
        return None
    conds = []
    if ctx.user_id:
        conds += [Pqrs.assignee_id == ctx.user_id, Pqrs.created_by_id == ctx.user_id]
    if ctx.can("pqrs.view_area") and ctx.area_ids:
        conds.append(Pqrs.area_id.in_(ctx.area_ids))
    return or_(*conds) if conds else Pqrs.id.is_(None)


async def get_pqrs(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, *, full: bool = True) -> Pqrs:
    stmt: Select = select(Pqrs).where(Pqrs.id == pqrs_id, Pqrs.tenant_id == ctx.tid)
    cond = scope_condition(ctx)
    if cond is not None:
        stmt = stmt.where(cond)
    if full:
        # populate_existing: refresca colecciones ya cargadas en la sesión tras cada cambio.
        stmt = stmt.options(
            selectinload(Pqrs.events), selectinload(Pqrs.attachments), selectinload(Pqrs.responses)
        ).execution_options(populate_existing=True)
    p = (await session.execute(stmt)).scalar_one_or_none()
    if p is None:
        raise NotFoundError("PQRS no encontrada.")
    return p


@dataclass
class ListFilters:
    q: str | None = None
    status: list[str] | None = None
    segment: str | None = None
    request_type_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    area_id: uuid.UUID | None = None
    priority: str | None = None
    channel: str | None = None
    client_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    assignee_id: uuid.UUID | None = None
    mine: bool = False
    open_only: bool = False
    sla_state: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None


def _apply_filters(stmt: Select, ctx: Ctx, f: ListFilters) -> Select:
    stmt = stmt.where(Pqrs.tenant_id == ctx.tid)
    cond = scope_condition(ctx)
    if cond is not None:
        stmt = stmt.where(cond)
    if f.q:
        like = f"%{f.q}%"
        stmt = stmt.where(or_(Pqrs.radicado.ilike(like), Pqrs.subject.ilike(like), Pqrs.requester_name.ilike(like),
                              Pqrs.requester_document.ilike(like)))
    for col, value in (
        (Pqrs.segment, f.segment), (Pqrs.request_type_id, f.request_type_id), (Pqrs.category_id, f.category_id),
        (Pqrs.area_id, f.area_id), (Pqrs.priority, f.priority), (Pqrs.channel, f.channel),
        (Pqrs.client_id, f.client_id), (Pqrs.site_id, f.site_id), (Pqrs.assignee_id, f.assignee_id),
    ):
        if value:
            stmt = stmt.where(col == value)
    if f.status:
        stmt = stmt.where(Pqrs.status.in_(f.status))
    if f.mine and ctx.user_id:
        stmt = stmt.where(Pqrs.assignee_id == ctx.user_id)
    if f.open_only:
        stmt = stmt.where(Pqrs.status.not_in(FINAL_STATUSES))
    if f.date_from:
        stmt = stmt.where(Pqrs.created_at >= f.date_from)
    if f.date_to:
        stmt = stmt.where(Pqrs.created_at <= f.date_to)
    now = _now()
    open_ = and_(Pqrs.status.not_in(FINAL_STATUSES), Pqrs.paused_at.is_(None))
    if f.sla_state == "overdue":
        stmt = stmt.where(open_, Pqrs.sla_due_at < now)
    elif f.sla_state == "at_risk":
        stmt = stmt.where(open_, Pqrs.sla_warning_at <= now, Pqrs.sla_due_at >= now)
    elif f.sla_state == "on_time":
        stmt = stmt.where(Pqrs.status.not_in(FINAL_STATUSES),
                          or_(Pqrs.paused_at.is_not(None), Pqrs.sla_warning_at > now))
    elif f.sla_state == "met":
        stmt = stmt.where(Pqrs.status == "responded", Pqrs.resolved_at <= Pqrs.sla_due_at)
    elif f.sla_state == "missed":
        stmt = stmt.where(Pqrs.status == "responded", Pqrs.resolved_at > Pqrs.sla_due_at)
    return stmt


async def list_pqrs(session: AsyncSession, ctx: Ctx, f: ListFilters, page: int, page_size: int) -> tuple[list[Pqrs], int]:
    base = _apply_filters(select(Pqrs), ctx, f)
    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = await session.execute(base.order_by(Pqrs.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return list(rows.scalars()), total


# --- Radicación ---

async def create_pqrs(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    data: dict,
    *,
    ctx: Ctx | None,
    channel: str,
    files: list[UploadedFile] | None = None,
    actor_label: str | None = None,
) -> Pqrs:
    """Radica una PQRS desde cualquier canal. `ctx` es None cuando llega del portal público o del correo."""
    files = files or []
    _check_files(files)
    segment = data["segment"]
    suggested = await catalog.resolve(
        session, tenant_id, segment=segment, request_type_id=data["request_type_id"],
        category_id=data.get("category_id"), subcategory_id=data.get("subcategory_id"),
    )
    requester = data.get("requester") or {}
    client_id, site_id, employee_id = None, None, None
    if segment == "external":
        client_id, site_id = await clients.validate_client_site(
            session, tenant_id, data.get("client_id"), data.get("site_id")
        )
    else:
        if data.get("employee_id"):
            emp = await employees.employee_brief(session, tenant_id, data["employee_id"])
            if emp is None:
                raise ValidationError("Empleado inválido.")
            employee_id = emp["id"]
        elif requester.get("document"):
            emp_row = await employees.find_by_document(session, tenant_id, requester["document"])
            employee_id = emp_row.id if emp_row else None

    area_id = data.get("area_id") or suggested["area_id"]
    if area_id and await identity.area_brief(session, tenant_id, area_id) is None:
        raise ValidationError("Área inválida.")
    tenant = await tenancy.get_tenant_info(session, tenant_id)
    now = _now()
    # La vigencia del radicado sigue la hora local de la empresa (no UTC).
    year = now.astimezone((await sla.get_calendar(session, tenant_id)).zone).year
    seq = await tenancy.next_sequence(session, tenant_id, f"radicado:{year}")
    prefix = tenant["radicado_prefix"]
    radicado = f"{prefix}-{year}-{seq:06d}" if prefix else f"{year}-{seq:06d}"
    anonymous = bool(data.get("is_anonymous"))

    p = Pqrs(
        tenant_id=tenant_id,
        radicado=radicado,
        public_code=random_code(),
        segment=segment,
        channel=channel,
        status="received",
        priority=data.get("priority") or suggested["priority"] or sla.DEFAULT_PRIORITY,
        request_type_id=data["request_type_id"],
        category_id=data.get("category_id"),
        subcategory_id=data.get("subcategory_id"),
        area_id=area_id,
        subject=data["subject"].strip(),
        description=data["description"].strip(),
        is_anonymous=anonymous,
        client_id=client_id,
        site_id=site_id,
        employee_id=employee_id,
        requester_name=None if anonymous else requester.get("name"),
        requester_doc_type=None if anonymous else requester.get("doc_type"),
        requester_document=None if anonymous else requester.get("document"),
        # Un anónimo puede dejar correo SOLO para recibir la respuesta.
        requester_email=requester.get("email"),
        requester_phone=None if anonymous else requester.get("phone"),
        requester_company=requester.get("company"),
        requester_address=None if anonymous else requester.get("address"),
        consent_at=now if data.get("consent", True) else None,
        created_by_id=ctx.user_id if ctx else None,
        external_ref=data.get("external_ref"),
        created_at=now,
        updated_at=now,
    )
    session.add(p)
    await session.flush()
    await _apply_sla(session, p, refresh_policy=True)
    session.add(_event(p, ctx, "created", to_status="received", internal=False,
                       note=f"Radicada por canal {channel}.", actor_label=actor_label))
    await _store_files(session, p, files, "requester" if ctx is None else "staff", ctx.user_id if ctx else None,
                       public=True)
    emit(session, "pqrs.created", tenant_id, pqrs_id=p.id)
    if data.get("assignee_id"):
        await _assign(session, ctx, p, data["assignee_id"], None)
    await commit_and_dispatch(session)
    return p


# --- Gestión ---

async def classify(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, data: dict) -> Pqrs:
    p = await get_pqrs(session, ctx, pqrs_id)
    if p.status in FINAL_STATUSES:
        raise ValidationError("El caso ya está cerrado.")
    rt = data.get("request_type_id") or p.request_type_id
    cat = data["category_id"] if "category_id" in data else p.category_id
    sub = data["subcategory_id"] if "subcategory_id" in data else (p.subcategory_id if cat == p.category_id else None)
    suggested = await catalog.resolve(session, ctx.tid, segment=p.segment, request_type_id=rt,
                                      category_id=cat, subcategory_id=sub)
    changes: dict = {}
    for field, value in (("request_type_id", rt), ("category_id", cat), ("subcategory_id", sub)):
        if getattr(p, field) != value:
            changes[field] = str(value) if value else None
            setattr(p, field, value)
    area = data.get("area_id") or (suggested["area_id"] if "category_id" in data and not p.area_id else None)
    if area and area != p.area_id:
        if await identity.area_brief(session, ctx.tid, area) is None:
            raise ValidationError("Área inválida.")
        p.area_id, changes["area_id"] = area, str(area)
    priority = data.get("priority")
    if priority and priority != p.priority:
        p.priority, changes["priority"] = priority, priority
        await _apply_sla(session, p, refresh_policy=True)
    if p.segment == "external" and ("client_id" in data or "site_id" in data):
        p.client_id, p.site_id = await clients.validate_client_site(
            session, ctx.tid, data.get("client_id", p.client_id), data.get("site_id")
        )
        changes["client_id"] = str(p.client_id) if p.client_id else None
    if p.segment == "internal" and data.get("employee_id"):
        if await employees.employee_brief(session, ctx.tid, data["employee_id"]) is None:
            raise ValidationError("Empleado inválido.")
        p.employee_id, changes["employee_id"] = data["employee_id"], str(data["employee_id"])
    if changes:
        session.add(_event(p, ctx, "classified", note=data.get("note"), data=changes))
        if "area_id" in changes:
            emit(session, "pqrs.area_changed", ctx.tid, pqrs_id=p.id)
    await commit_and_dispatch(session)
    return await get_pqrs(session, ctx, pqrs_id)


async def _assign(session: AsyncSession, ctx: Ctx | None, p: Pqrs, assignee_id: uuid.UUID | None, note: str | None) -> None:
    if assignee_id is not None:
        user = await identity.user_brief(session, assignee_id)
        if user is None or user["tenant_id"] != p.tenant_id or not user["active"]:
            raise ValidationError("El responsable no existe o está inactivo.")
    old_status = p.status
    p.assignee_id = assignee_id
    if assignee_id and p.status == "received":
        p.status = "assigned"
    elif assignee_id is None and p.status == "assigned":
        p.status = "received"
    _mark_first_response(p)
    session.add(_event(p, ctx, "assigned", note=note, from_status=old_status, to_status=p.status,
                       data={"assignee_id": str(assignee_id) if assignee_id else None},
                       internal=True))
    if assignee_id:
        emit(session, "pqrs.assigned", p.tenant_id, pqrs_id=p.id, assignee_id=assignee_id,
             by=ctx.user_id if ctx else None)


async def assign(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, assignee_id: uuid.UUID | None, note: str | None) -> Pqrs:
    p = await get_pqrs(session, ctx, pqrs_id)
    if p.status in FINAL_STATUSES:
        raise ValidationError("El caso ya está cerrado.")
    await _assign(session, ctx, p, assignee_id, note)
    await commit_and_dispatch(session)
    return await get_pqrs(session, ctx, pqrs_id)


async def change_status(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, status: str, note: str | None) -> Pqrs:
    p = await get_pqrs(session, ctx, pqrs_id)
    if status not in TRANSITIONS.get(p.status, set()):
        raise ValidationError(f"No se puede pasar de '{p.status}' a '{status}'.")
    if status == "cancelled" and not ctx.can("pqrs.approve") and not ctx.can("pqrs.classify"):
        raise ForbiddenError("Anular un caso requiere permiso de clasificación o aprobación.")
    now, old = _now(), p.status
    if old == "on_hold":
        await _close_pause(session, p, now)
    if status == "on_hold" and (p.sla_policy or {}).get("pause_on_hold", True):
        p.paused_at = now
    if status == "received":
        p.assignee_id = None
    p.status = status
    _mark_first_response(p)
    # La pausa (en espera) se informa al solicitante: suele ser una solicitud de información.
    public = status in ("on_hold", "cancelled")
    session.add(_event(p, ctx, "status_changed", note=note, from_status=old, to_status=status, internal=not public))
    emit(session, "pqrs.status_changed", ctx.tid, pqrs_id=p.id, from_status=old, to_status=status, note=note,
         public=public)
    await commit_and_dispatch(session)
    return await get_pqrs(session, ctx, pqrs_id)


async def add_comment(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, note: str, public: bool,
                      files: list[UploadedFile] | None = None) -> Pqrs:
    p = await get_pqrs(session, ctx, pqrs_id)
    files = files or []
    _check_files(files)
    atts = await _store_files(session, p, files, "staff", ctx.user_id, public=public)
    await session.flush()
    session.add(_event(p, ctx, "message" if public else "comment", note=note, internal=not public,
                       data={"attachments": [str(a.id) for a in atts]}))
    if public:
        _mark_first_response(p)
        emit(session, "pqrs.public_message", ctx.tid, pqrs_id=p.id, note=note)
    await commit_and_dispatch(session)
    return await get_pqrs(session, ctx, pqrs_id)


async def add_attachments(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, files: list[UploadedFile], public: bool) -> Pqrs:
    p = await get_pqrs(session, ctx, pqrs_id)
    _check_files(files)
    atts = await _store_files(session, p, files, "staff", ctx.user_id, public)
    session.add(_event(p, ctx, "attachment_added", internal=not public,
                       note=", ".join(a.filename for a in atts)))
    await commit_and_dispatch(session)
    return await get_pqrs(session, ctx, pqrs_id)


# --- Respuesta formal y aprobación ---

def _current_response(p: Pqrs) -> PqrsResponse | None:
    pending = [r for r in p.responses if r.status in ("draft", "pending_approval", "returned")]
    return pending[-1] if pending else None


async def save_response(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, body: str, action: str) -> Pqrs:
    p = await get_pqrs(session, ctx, pqrs_id)
    if p.status in FINAL_STATUSES:
        raise ValidationError("El caso ya está cerrado.")
    if action == "send" and not ctx.can("pqrs.approve"):
        raise ForbiddenError("Enviar sin aprobación requiere el permiso de aprobar respuestas.")
    resp = _current_response(p)
    if resp is None:
        resp = PqrsResponse(tenant_id=ctx.tid, pqrs_id=p.id, body=body, author_id=ctx.user_id)
        session.add(resp)
        p.responses.append(resp)
    elif resp.status == "pending_approval" and action == "draft":
        raise ValidationError("La respuesta está en aprobación; espera la revisión.")
    resp.body = body
    resp.author_id = resp.author_id or ctx.user_id
    old = p.status
    if action == "draft":
        resp.status = "draft"
        session.add(_event(p, ctx, "response_draft", note="Borrador de respuesta guardado."))
        await commit_and_dispatch(session)
        return await get_pqrs(session, ctx, pqrs_id)
    if p.status == "on_hold":
        await _close_pause(session, p, _now())
    resp.status, resp.submitted_at = "pending_approval", _now()
    p.status = "pending_approval"
    _mark_first_response(p)
    session.add(_event(p, ctx, "response_submitted", from_status=old, to_status="pending_approval",
                       note="Respuesta proyectada y enviada a aprobación."))
    if action == "send":
        await session.flush()
        await _approve(session, ctx, p, resp, None, None)
    else:
        emit(session, "pqrs.response_submitted", ctx.tid, pqrs_id=p.id, response_id=resp.id, area_id=p.area_id)
    await commit_and_dispatch(session)
    return await get_pqrs(session, ctx, pqrs_id)


async def _approve(session: AsyncSession, ctx: Ctx, p: Pqrs, resp: PqrsResponse, note: str | None, body: str | None) -> None:
    from app.modules.documents.public import render_response_letter

    if body:
        resp.body = body
    tenant = await tenancy.get_tenant_info(session, p.tenant_id)
    signer = await identity.user_brief(session, ctx.user_id)
    default_signer_id = (tenant["settings"].get("letter") or {}).get("signer_user_id")
    if (not signer or not signer.get("signature_key")) and default_signer_id:
        signer = await identity.user_brief(session, uuid.UUID(str(default_signer_id))) or signer
    names = await catalog.names(session, p.tenant_id)
    client = await clients.client_contact(session, p.tenant_id, p.client_id)
    pdf = await render_response_letter(
        tenant=tenant,
        case={
            "radicado": p.radicado,
            "created_at": p.created_at,
            "subject": p.subject,
            "request_type": names["request_types"].get(p.request_type_id, ""),
            "requester_name": p.requester_name or ("Anónimo" if p.is_anonymous else ""),
            "requester_company": (client or {}).get("name") or p.requester_company,
            "requester_email": p.requester_email,
            "requester_address": p.requester_address or (client or {}).get("address"),
        },
        body=resp.body,
        signer=signer,
    )
    key = new_key(p.tenant_id, f"pqrs/{p.radicado}", f"respuesta_{p.radicado}.pdf")
    await storage().put(key, pdf, "application/pdf")
    now = _now()
    resp.pdf_key, resp.status, resp.reviewer_id, resp.reviewed_at = key, "sent", ctx.user_id, now
    resp.review_note, resp.signer_id = note, (signer or {}).get("id")
    resp.sent_at, resp.sent_to = now, p.requester_email
    session.add(PqrsAttachment(tenant_id=p.tenant_id, pqrs_id=p.id, key=key, filename=f"Respuesta {p.radicado}.pdf",
                               mime="application/pdf", size=len(pdf), source="response",
                               uploaded_by_id=ctx.user_id, public=True))
    old = p.status
    p.status, p.resolved_at = "responded", now
    session.add(_event(p, ctx, "response_sent", from_status=old, to_status="responded", internal=False,
                       note="Respuesta aprobada y enviada al solicitante."))
    await session.flush()
    emit(session, "pqrs.responded", p.tenant_id, pqrs_id=p.id, response_id=resp.id)


async def approve_response(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, response_id: uuid.UUID,
                           note: str | None, body: str | None) -> Pqrs:
    p = await get_pqrs(session, ctx, pqrs_id)
    resp = next((r for r in p.responses if r.id == response_id), None)
    if resp is None or resp.status != "pending_approval":
        raise ValidationError("No hay una respuesta pendiente de aprobación.")
    await _approve(session, ctx, p, resp, note, body)
    await commit_and_dispatch(session)
    return await get_pqrs(session, ctx, pqrs_id)


async def return_response(session: AsyncSession, ctx: Ctx, pqrs_id: uuid.UUID, response_id: uuid.UUID, note: str | None) -> Pqrs:
    if not note:
        raise ValidationError("Indica qué debe ajustarse en la respuesta.")
    p = await get_pqrs(session, ctx, pqrs_id)
    resp = next((r for r in p.responses if r.id == response_id), None)
    if resp is None or resp.status != "pending_approval":
        raise ValidationError("No hay una respuesta pendiente de aprobación.")
    resp.status, resp.reviewer_id, resp.reviewed_at, resp.review_note = "returned", ctx.user_id, _now(), note
    p.status = "in_progress"
    session.add(_event(p, ctx, "response_returned", from_status="pending_approval", to_status="in_progress",
                       note=note))
    emit(session, "pqrs.response_returned", ctx.tid, pqrs_id=p.id, author_id=resp.author_id, note=note)
    await commit_and_dispatch(session)
    return await get_pqrs(session, ctx, pqrs_id)


# --- Portal público ---

async def find_public(session: AsyncSession, tenant_id: uuid.UUID, radicado: str, code: str) -> Pqrs:
    stmt = (
        select(Pqrs)
        .where(Pqrs.tenant_id == tenant_id, Pqrs.radicado == radicado.strip().upper())
        .options(selectinload(Pqrs.events), selectinload(Pqrs.attachments), selectinload(Pqrs.responses))
    )
    p = (await session.execute(stmt)).scalar_one_or_none()
    if p is None or p.public_code != code.strip().upper():
        raise NotFoundError("Radicado o código de consulta incorrectos.")
    return p


async def public_reply(session: AsyncSession, tenant_id: uuid.UUID, radicado: str, code: str, message: str,
                       files: list[UploadedFile]) -> Pqrs:
    p = await find_public(session, tenant_id, radicado, code)
    if p.status in FINAL_STATUSES:
        raise ValidationError("El caso ya fue cerrado; radica una nueva solicitud.")
    _check_files(files)
    atts = await _store_files(session, p, files, "requester", None, public=True)
    await session.flush()
    old = p.status
    if p.status == "on_hold":
        await _close_pause(session, p, _now())
        p.status = "in_progress"
    session.add(_event(p, None, "requester_message", note=message, internal=False, from_status=old,
                       to_status=p.status, actor_label=p.requester_name or "Solicitante",
                       data={"attachments": [str(a.id) for a in atts]}))
    emit(session, "pqrs.requester_message", tenant_id, pqrs_id=p.id)
    await commit_and_dispatch(session)
    return p


# --- Barrido periódico (worker): alertas de vencimiento ---

async def sla_scan(session: AsyncSession) -> int:
    now = _now()
    stmt = select(Pqrs).where(Pqrs.status.not_in(FINAL_STATUSES), Pqrs.paused_at.is_(None),
                              Pqrs.sla_warning_at.is_not(None), Pqrs.sla_warning_at <= now)
    count = 0
    for p in (await session.execute(stmt)).scalars():
        state = "overdue" if p.sla_due_at and p.sla_due_at < now else "at_risk"
        if p.sla_alerted == state:
            continue
        p.sla_alerted = state
        emit(session, "pqrs.sla_alert", p.tenant_id, pqrs_id=p.id, state=state)
        count += 1
    await commit_and_dispatch(session)
    return count



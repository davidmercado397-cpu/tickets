from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile, status
from pydantic import ValidationError as PydanticValidationError

from app.core.config import get_settings
from app.core.context import Ctx
from app.core.errors import NotFoundError, ValidationError
from app.core.ratelimit import enforce_rate_limit
from app.core.storage import storage
from app.modules.catalog import public as catalog
from app.modules.identity.public import SessionDep, TenantCtxDep, require
from app.modules.pqrs import mapping, service
from app.modules.pqrs.models import PqrsAttachment
from app.modules.pqrs.schemas import (
    AssignIn,
    Channel,
    ClassifyIn,
    CommentIn,
    PqrsCreate,
    PqrsDetail,
    PqrsPage,
    Priority,
    PublicCreated,
    PublicEvent,
    PublicPqrsCreate,
    PublicStatusOut,
    AttachmentOut,
    ResponseIn,
    ReviewIn,
    Segment,
    SlaState,
    StatusIn,
)
from app.modules.pqrs.service import UploadedFile
from app.modules.tenancy.public import IntegrationCtxDep, tenant_id_by_slug

router = APIRouter(prefix="/pqrs", tags=["PQRS"])
public_router = APIRouter(prefix="/public/tenants", tags=["portal público"])
integration_router = APIRouter(prefix="/integrations", tags=["integraciones"])

ViewCtx = Annotated[Ctx, Depends(require("pqrs.view_all", "pqrs.view_area", "pqrs.manage", "pqrs.respond",
                                          "pqrs.approve", "pqrs.create"))]
CreateCtx = Annotated[Ctx, Depends(require("pqrs.create"))]
ClassifyCtx = Annotated[Ctx, Depends(require("pqrs.classify"))]
AssignCtx = Annotated[Ctx, Depends(require("pqrs.assign"))]
ManageCtx = Annotated[Ctx, Depends(require("pqrs.manage", "pqrs.classify", "pqrs.approve"))]
RespondCtx = Annotated[Ctx, Depends(require("pqrs.respond", "pqrs.approve"))]
ApproveCtx = Annotated[Ctx, Depends(require("pqrs.approve"))]


async def _files(files: list[UploadFile] | None) -> list[UploadedFile]:
    out = []
    for f in files or []:
        if f.filename:
            out.append(UploadedFile(f.filename, f.content_type or "application/octet-stream", await f.read()))
    return out


async def _detail(session, ctx: Ctx, p) -> PqrsDetail:
    names = await mapping.load_names(session, ctx.tid, [p])
    return mapping.detail(p, names)


@router.get("", response_model=PqrsPage)
async def list_pqrs(
    ctx: ViewCtx,
    session: SessionDep,
    q: str | None = None,
    status_: Annotated[list[str] | None, Query(alias="status")] = None,
    segment: Segment | None = None,
    request_type_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    area_id: uuid.UUID | None = None,
    priority: Priority | None = None,
    channel: Channel | None = None,
    client_id: uuid.UUID | None = None,
    site_id: uuid.UUID | None = None,
    assignee_id: uuid.UUID | None = None,
    mine: bool = False,
    open_only: bool = False,
    sla_state: SlaState | None = None,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
) -> PqrsPage:
    filters = service.ListFilters(
        q=q, status=status_, segment=segment, request_type_id=request_type_id, category_id=category_id,
        area_id=area_id, priority=priority, channel=channel, client_id=client_id, site_id=site_id,
        assignee_id=assignee_id, mine=mine, open_only=open_only, sla_state=sla_state,
        date_from=date_from, date_to=date_to,
    )
    items, total = await service.list_pqrs(session, ctx, filters, page, page_size)
    names = await mapping.load_names(session, ctx.tid, items)
    return PqrsPage(items=[mapping.summary(p, names) for p in items], total=total, page=page, page_size=page_size)


@router.post("", response_model=PqrsDetail, status_code=status.HTTP_201_CREATED)
async def create_pqrs(
    ctx: CreateCtx,
    session: SessionDep,
    data: Annotated[str, Form(description="JSON con los campos de PqrsCreate")],
    files: list[UploadFile] | None = File(None),
) -> PqrsDetail:
    """Radicación manual (ventanilla): multipart con `data` (JSON) + archivos opcionales."""
    try:
        body = PqrsCreate.model_validate_json(data)
    except PydanticValidationError as exc:
        raise ValidationError(exc.errors()[0]["msg"]) from exc
    if body.assignee_id and not ctx.can("pqrs.assign"):
        body.assignee_id = None
    p = await service.create_pqrs(session, ctx.tid, body.model_dump(), ctx=ctx, channel=body.channel,
                                  files=await _files(files))
    return await _detail(session, ctx, await service.get_pqrs(session, ctx, p.id))


@router.get("/{pqrs_id}", response_model=PqrsDetail)
async def get_pqrs(pqrs_id: uuid.UUID, ctx: ViewCtx, session: SessionDep) -> PqrsDetail:
    return await _detail(session, ctx, await service.get_pqrs(session, ctx, pqrs_id))


@router.post("/{pqrs_id}/classify", response_model=PqrsDetail)
async def classify(pqrs_id: uuid.UUID, body: ClassifyIn, ctx: ClassifyCtx, session: SessionDep) -> PqrsDetail:
    p = await service.classify(session, ctx, pqrs_id, body.model_dump(exclude_unset=True))
    return await _detail(session, ctx, p)


@router.post("/{pqrs_id}/assign", response_model=PqrsDetail)
async def assign(pqrs_id: uuid.UUID, body: AssignIn, ctx: AssignCtx, session: SessionDep) -> PqrsDetail:
    return await _detail(session, ctx, await service.assign(session, ctx, pqrs_id, body.assignee_id, body.note))


@router.post("/{pqrs_id}/status", response_model=PqrsDetail)
async def change_status(pqrs_id: uuid.UUID, body: StatusIn, ctx: ManageCtx, session: SessionDep) -> PqrsDetail:
    return await _detail(session, ctx, await service.change_status(session, ctx, pqrs_id, body.status, body.note))


@router.post("/{pqrs_id}/comments", response_model=PqrsDetail)
async def comment(pqrs_id: uuid.UUID, body: CommentIn, ctx: ManageCtx, session: SessionDep) -> PqrsDetail:
    return await _detail(session, ctx, await service.add_comment(session, ctx, pqrs_id, body.note, body.public))


@router.post("/{pqrs_id}/attachments", response_model=PqrsDetail)
async def upload(
    pqrs_id: uuid.UUID, ctx: ManageCtx, session: SessionDep,
    files: list[UploadFile] = File(...), public: bool = Form(False),
) -> PqrsDetail:
    p = await service.add_attachments(session, ctx, pqrs_id, await _files(files), public)
    return await _detail(session, ctx, p)


@router.get("/{pqrs_id}/attachments/{attachment_id}")
async def download(pqrs_id: uuid.UUID, attachment_id: uuid.UUID, ctx: ViewCtx, session: SessionDep) -> Response:
    await service.get_pqrs(session, ctx, pqrs_id, full=False)  # valida alcance
    att = await session.get(PqrsAttachment, attachment_id)
    if att is None or att.pqrs_id != pqrs_id:
        raise NotFoundError("Adjunto no encontrado.")
    return Response(await storage().get(att.key), media_type=att.mime,
                    headers={"Content-Disposition": f'inline; filename="{att.filename}"'})


@router.post("/{pqrs_id}/responses", response_model=PqrsDetail)
async def save_response(pqrs_id: uuid.UUID, body: ResponseIn, ctx: RespondCtx, session: SessionDep) -> PqrsDetail:
    return await _detail(session, ctx, await service.save_response(session, ctx, pqrs_id, body.body, body.action))


@router.post("/{pqrs_id}/responses/{response_id}/approve", response_model=PqrsDetail)
async def approve(pqrs_id: uuid.UUID, response_id: uuid.UUID, body: ReviewIn, ctx: ApproveCtx, session: SessionDep) -> PqrsDetail:
    p = await service.approve_response(session, ctx, pqrs_id, response_id, body.note, body.body)
    return await _detail(session, ctx, p)


@router.post("/{pqrs_id}/responses/{response_id}/return", response_model=PqrsDetail)
async def return_response(pqrs_id: uuid.UUID, response_id: uuid.UUID, body: ReviewIn, ctx: ApproveCtx, session: SessionDep) -> PqrsDetail:
    return await _detail(session, ctx, await service.return_response(session, ctx, pqrs_id, response_id, body.note))


@router.post("/{pqrs_id}/responses/preview")
async def preview_response(pqrs_id: uuid.UUID, body: ResponseIn, ctx: RespondCtx, session: SessionDep) -> Response:
    """PDF de vista previa de la carta (no se guarda ni se envía)."""
    from app.modules.documents.public import render_response_letter
    from app.modules.identity.public import user_brief
    from app.modules.tenancy.public import get_tenant_info

    p = await service.get_pqrs(session, ctx, pqrs_id, full=False)
    names = await catalog.names(session, ctx.tid)
    pdf = await render_response_letter(
        tenant=await get_tenant_info(session, ctx.tid),
        case={"radicado": p.radicado, "created_at": p.created_at, "subject": p.subject,
              "request_type": names["request_types"].get(p.request_type_id, ""),
              "requester_name": p.requester_name or "", "requester_company": p.requester_company,
              "requester_email": p.requester_email, "requester_address": p.requester_address},
        body=body.body,
        signer=await user_brief(session, ctx.user_id),
        draft=True,
    )
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": "inline; filename=vista_previa.pdf"})


# --- Portal público ---

def _public_status(p) -> PublicStatusOut:
    sent = [r for r in p.responses if r.status == "sent"]
    return PublicStatusOut(
        radicado=p.radicado,
        status=p.status,
        subject=p.subject,
        request_type=None,
        created_at=p.created_at,
        sla_due_at=p.sla_due_at,
        events=[PublicEvent(at=e.at, kind=e.kind, to_status=e.to_status, note=e.note) for e in p.events if not e.internal],
        response_available=bool(sent),
        response_sent_at=sent[-1].sent_at if sent else None,
        can_reply=p.status not in ("responded", "cancelled"),
        attachments=[AttachmentOut.model_validate(a) for a in p.attachments if a.public],
    )


@public_router.post("/{slug}/pqrs", response_model=PublicCreated, status_code=status.HTTP_201_CREATED)
async def public_create(
    slug: str,
    request: Request,
    session: SessionDep,
    data: Annotated[str, Form()],
    files: list[UploadFile] | None = File(None),
) -> PublicCreated:
    await enforce_rate_limit(request, f"radicar:{slug}", get_settings().PUBLIC_RATE_LIMIT_PER_HOUR)
    try:
        body = PublicPqrsCreate.model_validate(json.loads(data))
    except (PydanticValidationError, ValueError) as exc:
        msg = exc.errors()[0]["msg"] if isinstance(exc, PydanticValidationError) else "Datos inválidos."
        raise ValidationError(msg.removeprefix("Value error, ")) from exc
    if body.website:  # honeypot relleno = bot
        raise ValidationError("Solicitud rechazada.")
    tenant_id = await tenant_id_by_slug(session, slug)
    p = await service.create_pqrs(
        session, tenant_id, body.model_dump(exclude={"website"}), ctx=None, channel="web",
        files=await _files(files), actor_label=body.requester.name or "Solicitante",
    )
    return PublicCreated(radicado=p.radicado, public_code=p.public_code, sla_due_at=p.sla_due_at)


@public_router.get("/{slug}/pqrs/{radicado}", response_model=PublicStatusOut)
async def public_status(slug: str, radicado: str, code: str, request: Request, session: SessionDep) -> PublicStatusOut:
    await enforce_rate_limit(request, "consulta", 120)
    tenant_id = await tenant_id_by_slug(session, slug)
    p = await service.find_public(session, tenant_id, radicado, code)
    out = _public_status(p)
    out.request_type = (await catalog.names(session, tenant_id))["request_types"].get(p.request_type_id)
    return out


@public_router.post("/{slug}/pqrs/{radicado}/messages", response_model=PublicStatusOut)
async def public_message(
    slug: str, radicado: str, request: Request, session: SessionDep,
    code: Annotated[str, Form()], message: Annotated[str, Form(min_length=3, max_length=10000)],
    files: list[UploadFile] | None = File(None),
) -> PublicStatusOut:
    await enforce_rate_limit(request, "mensaje", 30)
    tenant_id = await tenant_id_by_slug(session, slug)
    p = await service.public_reply(session, tenant_id, radicado, code, message, await _files(files))
    return _public_status(await service.find_public(session, tenant_id, p.radicado, code))


@public_router.get("/{slug}/pqrs/{radicado}/attachments/{attachment_id}")
async def public_download(slug: str, radicado: str, attachment_id: uuid.UUID, code: str, session: SessionDep) -> Response:
    tenant_id = await tenant_id_by_slug(session, slug)
    p = await service.find_public(session, tenant_id, radicado, code)
    att = next((a for a in p.attachments if a.id == attachment_id and a.public), None)
    if att is None:
        raise NotFoundError("Archivo no encontrado.")
    return Response(await storage().get(att.key), media_type=att.mime,
                    headers={"Content-Disposition": f'inline; filename="{att.filename}"'})


# --- Integraciones (bot de WhatsApp, otros sistemas) ---

@integration_router.post("/pqrs", response_model=PublicCreated, status_code=status.HTTP_201_CREATED)
async def integration_create(body: PqrsCreate, ctx: IntegrationCtxDep, session: SessionDep) -> PublicCreated:
    """Radicación desde una integración (`X-Api-Key`). Para WhatsApp usar `channel="whatsapp"` y
    `external_ref` = id de la conversación del Gateway."""
    channel = body.channel if body.channel in ("whatsapp", "integration") else "integration"
    p = await service.create_pqrs(session, ctx.tid, body.model_dump(), ctx=ctx, channel=channel)
    return PublicCreated(radicado=p.radicado, public_code=p.public_code, sla_due_at=p.sla_due_at)


@integration_router.get("/pqrs/{radicado}", response_model=PublicStatusOut)
async def integration_status(radicado: str, code: str, ctx: IntegrationCtxDep, session: SessionDep) -> PublicStatusOut:
    return _public_status(await service.find_public(session, ctx.tid, radicado, code))

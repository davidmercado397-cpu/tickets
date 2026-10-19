"""Endpoints del análisis de causa raíz de una PQRS."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.core.context import Ctx
from app.modules.catalog import public as catalog
from app.modules.clients import public as clients
from app.modules.identity import public as identity
from app.modules.identity.public import SessionDep, require
from app.modules.pqrs import rca as flow
from app.modules.pqrs.models import Pqrs, RootCauseAnalysis
from app.modules.pqrs.schemas import (
    Named,
    RcaActionIn,
    RcaActionOut,
    RcaCloseIn,
    RcaConsolidateIn,
    RcaContributionIn,
    RcaOut,
    RcaParticipantOut,
    RcaReopenIn,
    RcaSetupIn,
    RcaValidateIn,
)
from app.modules.tenancy.public import get_tenant_info

router = APIRouter(prefix="/pqrs", tags=["PQRS · causa raíz"])
RcaCtx = Annotated[Ctx, Depends(require("pqrs.rca_manage", "pqrs.rca_contribute"))]
ManageCtx = Annotated[Ctx, Depends(require("pqrs.rca_manage"))]


async def to_out(session, ctx: Ctx, p: Pqrs, rca: RootCauseAnalysis) -> RcaOut:
    areas = await identity.area_names(session, ctx.tid)
    acts = await flow.actions(session, ctx.tid, p.id)
    users = await identity.user_names(session, {a["assignee_id"] for a in acts if a["assignee_id"]})
    manage = ctx.can("pqrs.rca_manage")
    return RcaOut(
        status=rca.status,
        method=rca.method,
        problem_statement=rca.problem_statement,
        root_cause=rca.root_cause,
        cause_category=rca.cause_category,
        consolidated_at=rca.consolidated_at,
        consolidated_by=rca.consolidated_by,
        plan_required=rca.plan_required,
        validation_note=rca.validation_note,
        validated_at=rca.validated_at,
        validated_by=rca.validated_by,
        plan_summary=rca.plan_summary,
        closed_at=rca.closed_at,
        closed_by=rca.closed_by,
        participants=[
            RcaParticipantOut(
                area=Named(id=pt.area_id, name=areas.get(pt.area_id, "—")),
                analysis=pt.analysis,
                whys=pt.whys or [],
                contributed_by=pt.contributed_by_label,
                contributed_at=pt.contributed_at,
                can_contribute=rca.status == "analysis"
                and (manage or (ctx.can("pqrs.rca_contribute") and pt.area_id in ctx.area_ids)),
            )
            for pt in rca.participants
        ],
        actions=[
            RcaActionOut(id=a["id"], title=a["title"], status=a["status"], due_date=a["due_date"],
                         assignee=users.get(a["assignee_id"]) if a["assignee_id"] else None, overdue=a["overdue"])
            for a in acts
        ],
        can_manage=manage,
    )


async def _out(session, ctx: Ctx, pqrs_id: uuid.UUID) -> RcaOut:
    p, rca = await flow.get(session, ctx, pqrs_id)
    return await to_out(session, ctx, p, rca)


@router.get("/{pqrs_id}/rca", response_model=RcaOut)
async def get_rca(pqrs_id: uuid.UUID, ctx: RcaCtx, session: SessionDep) -> RcaOut:
    return await _out(session, ctx, pqrs_id)


@router.put("/{pqrs_id}/rca/setup", response_model=RcaOut)
async def setup(pqrs_id: uuid.UUID, body: RcaSetupIn, ctx: ManageCtx, session: SessionDep) -> RcaOut:
    await flow.setup(session, ctx, pqrs_id, body.model_dump())
    return await _out(session, ctx, pqrs_id)


@router.put("/{pqrs_id}/rca/contributions/{area_id}", response_model=RcaOut)
async def contribute(pqrs_id: uuid.UUID, area_id: uuid.UUID, body: RcaContributionIn, ctx: RcaCtx, session: SessionDep) -> RcaOut:
    await flow.contribute(session, ctx, pqrs_id, area_id, body.model_dump())
    return await _out(session, ctx, pqrs_id)


@router.post("/{pqrs_id}/rca/consolidate", response_model=RcaOut)
async def consolidate(pqrs_id: uuid.UUID, body: RcaConsolidateIn, ctx: ManageCtx, session: SessionDep) -> RcaOut:
    await flow.consolidate(session, ctx, pqrs_id, body.model_dump())
    return await _out(session, ctx, pqrs_id)


@router.post("/{pqrs_id}/rca/validate", response_model=RcaOut)
async def validate(pqrs_id: uuid.UUID, body: RcaValidateIn, ctx: ManageCtx, session: SessionDep) -> RcaOut:
    await flow.validate(session, ctx, pqrs_id, body.model_dump())
    return await _out(session, ctx, pqrs_id)


@router.post("/{pqrs_id}/rca/actions", response_model=RcaOut)
async def add_action(pqrs_id: uuid.UUID, body: RcaActionIn, ctx: ManageCtx, session: SessionDep) -> RcaOut:
    await flow.add_action(session, ctx, pqrs_id, body.model_dump())
    return await _out(session, ctx, pqrs_id)


@router.post("/{pqrs_id}/rca/close", response_model=RcaOut)
async def close(pqrs_id: uuid.UUID, body: RcaCloseIn, ctx: ManageCtx, session: SessionDep) -> RcaOut:
    await flow.close_plan(session, ctx, pqrs_id, body.summary)
    return await _out(session, ctx, pqrs_id)


@router.post("/{pqrs_id}/rca/reopen", response_model=RcaOut)
async def reopen(pqrs_id: uuid.UUID, body: RcaReopenIn, ctx: ManageCtx, session: SessionDep) -> RcaOut:
    await flow.reopen(session, ctx, pqrs_id, body.note)
    return await _out(session, ctx, pqrs_id)


@router.get("/{pqrs_id}/rca/report.pdf")
async def report(pqrs_id: uuid.UUID, ctx: RcaCtx, session: SessionDep) -> Response:
    """Informe PDF del análisis de causa raíz y su plan de acción (documentación de cierre)."""
    from app.modules.documents.public import render_rca_report

    p, rca = await flow.get(session, ctx, pqrs_id)
    out = await to_out(session, ctx, p, rca)
    names = await catalog.names(session, ctx.tid)
    cl = await clients.names(session, ctx.tid)
    pdf = await render_rca_report(
        tenant=await get_tenant_info(session, ctx.tid),
        case={
            "radicado": p.radicado, "subject": p.subject, "description": p.description, "created_at": p.created_at,
            "request_type": names["request_types"].get(p.request_type_id, ""),
            "category": names["categories"].get(p.category_id, "") if p.category_id else "",
            "client": cl["clients"].get(p.client_id, "") if p.client_id else (p.requester_company or ""),
            "site": cl["sites"].get(p.site_id, "") if p.site_id else "",
            "requester": p.requester_name or ("Anónimo" if p.is_anonymous else ""),
        },
        rca=out.model_dump(mode="json"),
    )
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="causa_raiz_{p.radicado}.pdf"'})

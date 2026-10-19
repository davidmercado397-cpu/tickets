from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from sqlalchemy import select

from app.core.context import Ctx
from app.core.errors import NotFoundError
from app.core.storage import storage
from app.modules.clients import public as clients
from app.modules.identity import public as identity
from app.modules.identity.public import SessionDep, require
from app.modules.tasks import public as tasks
from app.modules.visits import service
from app.modules.visits.models import Visit, VisitFile
from app.modules.visits.schemas import (
    AnswersIn,
    CompleteIn,
    ComplianceOut,
    FormIn,
    FormOut,
    Named,
    QuotaIn,
    QuotaOut,
    VisitFileOut,
    VisitOut,
    VisitPage,
    VisitStart,
    VisitSummary,
)

router = APIRouter(prefix="/visits", tags=["visitas"])
ManageVisits = Annotated[Ctx, Depends(require("visits.manage"))]
PerformVisits = Annotated[Ctx, Depends(require("visits.perform"))]
AnyVisits = Annotated[Ctx, Depends(require("visits.perform", "visits.manage", "visits.view_all"))]


async def _names(session, ctx: Ctx, visits: list[Visit]) -> tuple[dict, dict]:
    users = await identity.user_names(session, {v.visitor_id for v in visits})
    return users, await clients.names(session, ctx.tid)


def _summary(v: Visit, users: dict, names: dict) -> VisitSummary:
    return VisitSummary(
        id=v.id,
        form=Named(id=v.form_id, name=(v.form_snapshot or {}).get("name", "Formulario")),
        client=Named(id=v.client_id, name=names["clients"].get(v.client_id, "—")),
        site=Named(id=v.site_id, name=names["sites"].get(v.site_id, "—")),
        visitor=Named(id=v.visitor_id, name=users.get(v.visitor_id, "—")),
        status=v.status,
        started_at=v.started_at,
        completed_at=v.completed_at,
        score=v.score,
        findings_count=len(v.findings or []),
    )


async def _detail(session, ctx: Ctx, v: Visit) -> VisitOut:
    users, names = await _names(session, ctx, [v])
    files = (await session.execute(select_files(v.id))).scalars()
    return VisitOut(
        **_summary(v, users, names).model_dump(),
        form_version=v.form_version,
        fields=service._fields(v),
        answers=v.answers or {},
        observations=v.observations,
        latitude=v.latitude,
        longitude=v.longitude,
        findings=v.findings or [],
        files=[VisitFileOut.model_validate(f) for f in files],
        tasks=await tasks.tasks_for_source(session, ctx.tid, "visit", v.id),
    )


def select_files(visit_id: uuid.UUID):
    return select(VisitFile).where(VisitFile.visit_id == visit_id).order_by(VisitFile.created_at)


# --- Formularios ---

@router.get("/forms", response_model=list[FormOut])
async def list_forms(ctx: AnyVisits, session: SessionDep, active: bool | None = None) -> list[FormOut]:
    return [FormOut.model_validate(f) for f in await service.list_forms(session, ctx, bool(active))]


@router.post("/forms", response_model=FormOut, status_code=status.HTTP_201_CREATED)
async def create_form(body: FormIn, ctx: ManageVisits, session: SessionDep) -> FormOut:
    return FormOut.model_validate(await service.create_form(session, ctx, body.model_dump(mode="json")))


@router.get("/forms/{form_id}", response_model=FormOut)
async def get_form(form_id: uuid.UUID, ctx: AnyVisits, session: SessionDep) -> FormOut:
    return FormOut.model_validate(await service.get_form(session, ctx, form_id))


@router.put("/forms/{form_id}", response_model=FormOut)
async def update_form(form_id: uuid.UUID, body: FormIn, ctx: ManageVisits, session: SessionDep) -> FormOut:
    return FormOut.model_validate(await service.update_form(session, ctx, form_id, body.model_dump(mode="json")))


# --- Metas mensuales ---

@router.get("/quotas", response_model=list[QuotaOut])
async def list_quotas(ctx: AnyVisits, session: SessionDep) -> list[QuotaOut]:
    names = await clients.names(session, ctx.tid)
    return [
        QuotaOut(
            id=q.id,
            client=Named(id=q.client_id, name=names["clients"].get(q.client_id, "—")) if q.client_id else None,
            site=Named(id=q.site_id, name=names["sites"].get(q.site_id, "—")) if q.site_id else None,
            visits_per_month=q.visits_per_month, form_id=q.form_id, active=q.active,
        )
        for q in await service.list_quotas(session, ctx)
    ]


@router.put("/quotas", response_model=QuotaOut)
async def upsert_quota(body: QuotaIn, ctx: ManageVisits, session: SessionDep) -> QuotaOut:
    q = await service.upsert_quota(session, ctx, body.model_dump())
    names = await clients.names(session, ctx.tid)
    return QuotaOut(
        id=q.id,
        client=Named(id=q.client_id, name=names["clients"].get(q.client_id, "—")) if q.client_id else None,
        site=Named(id=q.site_id, name=names["sites"].get(q.site_id, "—")) if q.site_id else None,
        visits_per_month=q.visits_per_month, form_id=q.form_id, active=q.active,
    )


@router.delete("/quotas/{quota_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quota(quota_id: uuid.UUID, ctx: ManageVisits, session: SessionDep) -> None:
    await service.delete_quota(session, ctx, quota_id)


@router.get("/compliance", response_model=ComplianceOut)
async def compliance(ctx: AnyVisits, session: SessionDep, month: str | None = None) -> ComplianceOut:
    month = month or date.today().strftime("%Y-%m")
    return ComplianceOut(**await service.compliance(session, ctx.tid, month))


# --- Visitas ---

@router.get("", response_model=VisitPage)
async def list_visits(
    ctx: AnyVisits,
    session: SessionDep,
    client_id: uuid.UUID | None = None,
    site_id: uuid.UUID | None = None,
    visitor_id: uuid.UUID | None = None,
    status_: Annotated[str | None, Query(alias="status")] = None,
    month: str | None = None,
    mine: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
) -> VisitPage:
    f = dict(client_id=client_id, site_id=site_id, visitor_id=visitor_id, status=status_, month=month, mine=mine)
    items, total = await service.list_visits(session, ctx, f, page, page_size)
    users, names = await _names(session, ctx, items)
    return VisitPage(items=[_summary(v, users, names) for v in items], total=total, page=page, page_size=page_size)


@router.post("", response_model=VisitOut, status_code=status.HTTP_201_CREATED)
async def start_visit(body: VisitStart, ctx: PerformVisits, session: SessionDep) -> VisitOut:
    return await _detail(session, ctx, await service.start_visit(session, ctx, body.model_dump()))


@router.get("/{visit_id}", response_model=VisitOut)
async def get_visit(visit_id: uuid.UUID, ctx: AnyVisits, session: SessionDep) -> VisitOut:
    return await _detail(session, ctx, await service.get_visit(session, ctx, visit_id))


@router.put("/{visit_id}/answers", response_model=VisitOut)
async def save_answers(visit_id: uuid.UUID, body: AnswersIn, ctx: PerformVisits, session: SessionDep) -> VisitOut:
    v = await service.save_answers(session, ctx, visit_id, body.answers, body.observations)
    return await _detail(session, ctx, v)


@router.post("/{visit_id}/files", response_model=VisitFileOut, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    visit_id: uuid.UUID, ctx: PerformVisits, session: SessionDep,
    field_id: Annotated[str, Form()], file: UploadFile = File(...),
) -> VisitFileOut:
    f = await service.add_file(session, ctx, visit_id, field_id, file.filename or "foto.jpg",
                               file.content_type or "image/jpeg", await file.read())
    return VisitFileOut.model_validate(f)


@router.get("/{visit_id}/files/{file_id}")
async def download_photo(visit_id: uuid.UUID, file_id: uuid.UUID, ctx: AnyVisits, session: SessionDep) -> Response:
    await service.get_visit(session, ctx, visit_id)
    f = await session.get(VisitFile, file_id)
    if f is None or f.visit_id != visit_id:
        raise NotFoundError("Archivo no encontrado.")
    return Response(await storage().get(f.key), media_type=f.mime)


@router.post("/{visit_id}/complete", response_model=VisitOut)
async def complete(visit_id: uuid.UUID, body: CompleteIn, ctx: PerformVisits, session: SessionDep) -> VisitOut:
    v = await service.complete_visit(session, ctx, visit_id, body.model_dump())
    return await _detail(session, ctx, await service.get_visit(session, ctx, v.id))


@router.post("/{visit_id}/evaluate")
async def evaluate(visit_id: uuid.UUID, body: AnswersIn, ctx: PerformVisits, session: SessionDep) -> dict:
    """Previsualiza puntaje y hallazgos antes de cerrar (para proponer tareas)."""
    v = await service.save_answers(session, ctx, visit_id, body.answers, body.observations)
    score, findings = service.evaluate(service._fields(v), v.answers or {})
    return {"score": score, "findings": findings}


@router.delete("/{visit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(visit_id: uuid.UUID, ctx: PerformVisits, session: SessionDep) -> None:
    await service.delete_draft(session, ctx, visit_id)

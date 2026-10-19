"""PQRS ORM → schemas de salida, resolviendo nombres de otros módulos por sus fachadas públicas."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.catalog import public as catalog
from app.modules.clients import public as clients
from app.modules.employees import public as employees
from app.modules.identity import public as identity
from app.modules.pqrs.models import Pqrs
from app.modules.pqrs.schemas import (
    AttachmentOut,
    EventOut,
    Named,
    PqrsDetail,
    PqrsSummary,
    RequesterIn,
    ResponseOut,
    SlaOut,
)
from app.modules.pqrs.service import sla_state


@dataclass
class Names:
    catalog: dict
    areas: dict
    clients: dict
    users: dict
    employees: dict

    @staticmethod
    def named(mapping: dict, key: uuid.UUID | None) -> Named | None:
        if key is None:
            return None
        return Named(id=key, name=mapping.get(key, "—"))


async def load_names(session: AsyncSession, tenant_id: uuid.UUID, items: list[Pqrs]) -> Names:
    user_ids: set[uuid.UUID] = set()
    for p in items:
        user_ids.update(i for i in (p.assignee_id, p.created_by_id) if i)
        if "responses" in p.__dict__:
            for r in p.responses:
                user_ids.update(i for i in (r.author_id, r.reviewer_id) if i)
    return Names(
        catalog=await catalog.names(session, tenant_id),
        areas=await identity.area_names(session, tenant_id),
        clients=await clients.names(session, tenant_id),
        users=await identity.user_names(session, user_ids),
        employees=await employees.names(session, tenant_id) if any(p.employee_id for p in items) else {},
    )


def summary(p: Pqrs, n: Names) -> PqrsSummary:
    return PqrsSummary(
        id=p.id,
        radicado=p.radicado,
        segment=p.segment,
        channel=p.channel,
        status=p.status,
        priority=p.priority,
        subject=p.subject,
        request_type=n.named(n.catalog["request_types"], p.request_type_id),
        category=n.named(n.catalog["categories"], p.category_id),
        area=n.named(n.areas, p.area_id),
        client=n.named(n.clients["clients"], p.client_id),
        site=n.named(n.clients["sites"], p.site_id),
        requester_name=p.requester_name or ("Anónimo" if p.is_anonymous else None),
        assignee=n.named(n.users, p.assignee_id),
        created_at=p.created_at,
        sla_due_at=p.sla_due_at,
        sla_state=sla_state(p),
    )


def detail(p: Pqrs, n: Names) -> PqrsDetail:
    base = summary(p, n).model_dump()
    responses = []
    for r in p.responses:
        out = ResponseOut.model_validate(r)
        out.author_name = n.users.get(r.author_id) if r.author_id else None
        out.reviewer_name = n.users.get(r.reviewer_id) if r.reviewer_id else None
        out.has_pdf = bool(r.pdf_key)
        responses.append(out)
    return PqrsDetail(
        **base,
        public_code=p.public_code,
        description=p.description,
        subcategory=n.named(n.catalog["subcategories"], p.subcategory_id),
        employee=n.named(n.employees, p.employee_id),
        is_anonymous=p.is_anonymous,
        requester=RequesterIn(
            name=p.requester_name, doc_type=p.requester_doc_type, document=p.requester_document,
            email=p.requester_email, phone=p.requester_phone, company=p.requester_company,
            address=p.requester_address,
        ),
        consent_at=p.consent_at,
        external_ref=p.external_ref,
        created_by=n.named(n.users, p.created_by_id),
        sla=SlaOut(
            due_at=p.sla_due_at,
            warning_at=p.sla_warning_at,
            state=sla_state(p),
            policy={k: v for k, v in (p.sla_policy or {}).items() if k != "pauses"}
            | {"pauses": len((p.sla_policy or {}).get("pauses", []))},
            paused=p.paused_at is not None,
            first_response_at=p.first_response_at,
            resolved_at=p.resolved_at,
        ),
        events=[EventOut.model_validate(e) for e in p.events],
        attachments=[AttachmentOut.model_validate(a) for a in p.attachments],
        responses=responses,
    )

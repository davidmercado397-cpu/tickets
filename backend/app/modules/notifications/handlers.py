"""Oyentes de eventos de otros módulos → notificaciones al personal y correos al solicitante."""

from __future__ import annotations

from app.core.db import session_factory
from app.core.events import Event, subscribe
from app.core.jobs import enqueue
from app.modules.identity import public as identity
from app.modules.notifications import emails
from app.modules.notifications.service import notify
from app.modules.pqrs import public as pqrs
from app.modules.tenancy import public as tenancy

STATUS_LABELS = {
    "received": "Radicada", "assigned": "Asignada", "in_progress": "En trámite", "on_hold": "En espera",
    "pending_approval": "Respuesta en aprobación", "responded": "Respondida", "cancelled": "Anulada",
}


def _pqrs_link(p: dict) -> str:
    return f"/pqrs/{p['id']}"


async def _ctx(event: Event):
    session = session_factory()()
    p = await pqrs.pqrs_brief(session, event.payload["pqrs_id"])
    tenant = await tenancy.get_tenant_info(session, event.tenant_id)
    return session, p, tenant


def _staff_email_on(tenant: dict) -> bool:
    return (tenant["settings"].get("notifications") or {}).get("email_staff", True)


async def _email_requester(tenant: dict, p: dict, subject: str, html: str, attachments: list | None = None) -> None:
    if p.get("requester_email"):
        await enqueue("send_email", {
            "to": [p["requester_email"]], "subject": subject, "html": html,
            "attachments": attachments or [], "sender_name": tenant["name"],
        })


@subscribe("pqrs.created")
async def on_created(event: Event) -> None:
    session, p, tenant = await _ctx(event)
    async with session:
        if p["area_id"]:
            users = await identity.recipients(session, event.tenant_id, "pqrs.manage", p["area_id"])
        else:
            users = await identity.recipients(session, event.tenant_id, "pqrs.classify")
        title = f"Nueva PQRS {p['radicado']}"
        await notify(session, event.tenant_id, users, kind="pqrs_created", title=title, body=p["subject"],
                     link=_pqrs_link(p), email=_staff_email_on(tenant),
                     email_html=emails.layout(tenant, title, emails.p(p["subject"]),
                                              ("Ver caso", emails.staff_link(_pqrs_link(p)))))
    if (tenant["settings"].get("notifications") or {}).get("email_requester_on_create", True):
        due = p["sla_due_at"].strftime("%d/%m/%Y") if p["sla_due_at"] else None
        html = emails.layout(
            tenant, "Recibimos tu solicitud",
            emails.p(f"Hola {p['requester_name'] or ''}, tu solicitud fue radicada correctamente.")
            + emails.kv([("Radicado", p["radicado"]), ("Código de consulta", p["public_code"]),
                         ("Asunto", p["subject"]), ("Fecha estimada de respuesta", due)])
            + emails.p("Guarda el radicado y el código: con ellos puedes consultar el estado en nuestro portal."),
            ("Consultar mi solicitud", emails.portal_link(tenant, p["radicado"], p["public_code"])),
        )
        await _email_requester(tenant, p, f"Radicado {p['radicado']} - {tenant['name']}", html)


@subscribe("pqrs.area_changed")
async def on_area_changed(event: Event) -> None:
    session, p, tenant = await _ctx(event)
    async with session:
        if not p["area_id"]:
            return
        users = await identity.recipients(session, event.tenant_id, "pqrs.manage", p["area_id"])
        await notify(session, event.tenant_id, users, kind="pqrs_area", title=f"PQRS {p['radicado']} trasladada a tu área",
                     body=p["subject"], link=_pqrs_link(p))


@subscribe("pqrs.assigned")
async def on_assigned(event: Event) -> None:
    session, p, tenant = await _ctx(event)
    async with session:
        user = await identity.user_brief(session, event.payload["assignee_id"])
        if not user:
            return
        title = f"Te asignaron la PQRS {p['radicado']}"
        await notify(session, event.tenant_id, [user], kind="pqrs_assigned", title=title, body=p["subject"],
                     link=_pqrs_link(p), email=_staff_email_on(tenant), exclude=event.payload.get("by"),
                     email_html=emails.layout(tenant, title, emails.p(p["subject"]),
                                              ("Ver caso", emails.staff_link(_pqrs_link(p)))))


@subscribe("pqrs.response_submitted")
async def on_response_submitted(event: Event) -> None:
    session, p, tenant = await _ctx(event)
    async with session:
        users = await identity.recipients(session, event.tenant_id, "pqrs.approve")
        title = f"Respuesta por aprobar: {p['radicado']}"
        await notify(session, event.tenant_id, users, kind="pqrs_approval", title=title, body=p["subject"],
                     link=_pqrs_link(p), email=_staff_email_on(tenant),
                     email_html=emails.layout(tenant, title, emails.p("Hay una respuesta proyectada esperando tu aprobación."),
                                              ("Revisar respuesta", emails.staff_link(_pqrs_link(p)))))


@subscribe("pqrs.response_returned")
async def on_response_returned(event: Event) -> None:
    session, p, tenant = await _ctx(event)
    async with session:
        author = await identity.user_brief(session, event.payload.get("author_id"))
        if author:
            await notify(session, event.tenant_id, [author], kind="pqrs_returned",
                         title=f"Respuesta devuelta: {p['radicado']}", body=event.payload.get("note"), link=_pqrs_link(p))


@subscribe("pqrs.responded")
async def on_responded(event: Event) -> None:
    session, p, tenant = await _ctx(event)
    async with session:
        pdf_key, _ = await pqrs.response_pdf(session, event.payload["response_id"])
        if p["assignee_id"]:
            assignee = await identity.user_brief(session, p["assignee_id"])
            if assignee:
                await notify(session, event.tenant_id, [assignee], kind="pqrs_responded",
                             title=f"PQRS {p['radicado']} respondida", body=p["subject"], link=_pqrs_link(p))
    html = emails.layout(
        tenant, "Respuesta a tu solicitud",
        emails.p(f"Hola {p['requester_name'] or ''}, adjuntamos la respuesta a tu solicitud.")
        + emails.kv([("Radicado", p["radicado"]), ("Asunto", p["subject"])]),
        ("Ver en el portal", emails.portal_link(tenant, p["radicado"], p["public_code"])),
    )
    attachments = [{"key": pdf_key, "filename": f"Respuesta_{p['radicado']}.pdf", "mime": "application/pdf"}] if pdf_key else []
    await _email_requester(tenant, p, f"Respuesta al radicado {p['radicado']}", html, attachments)


@subscribe("pqrs.public_message")
async def on_public_message(event: Event) -> None:
    session, p, tenant = await _ctx(event)
    await session.close()
    html = emails.layout(
        tenant, f"Novedad en tu solicitud {p['radicado']}",
        emails.p(event.payload.get("note") or ""),
        ("Ver y responder", emails.portal_link(tenant, p["radicado"], p["public_code"])),
    )
    await _email_requester(tenant, p, f"Novedad en el radicado {p['radicado']}", html)


@subscribe("pqrs.status_changed")
async def on_status_changed(event: Event) -> None:
    if not event.payload.get("public"):
        return
    session, p, tenant = await _ctx(event)
    await session.close()
    status = event.payload["to_status"]
    intro = ("Necesitamos información adicional para continuar con tu solicitud:" if status == "on_hold"
             else f"Tu solicitud cambió a estado: {STATUS_LABELS.get(status, status)}.")
    html = emails.layout(
        tenant, f"Tu solicitud {p['radicado']}",
        emails.p(intro) + emails.p(event.payload.get("note") or ""),
        ("Ver solicitud", emails.portal_link(tenant, p["radicado"], p["public_code"])),
    )
    await _email_requester(tenant, p, f"Actualización del radicado {p['radicado']}", html)


@subscribe("pqrs.requester_message")
async def on_requester_message(event: Event) -> None:
    session, p, tenant = await _ctx(event)
    async with session:
        if p["assignee_id"]:
            users = [u for u in [await identity.user_brief(session, p["assignee_id"])] if u]
        elif p["area_id"]:
            users = await identity.recipients(session, event.tenant_id, "pqrs.manage", p["area_id"])
        else:
            users = await identity.recipients(session, event.tenant_id, "pqrs.classify")
        await notify(session, event.tenant_id, users, kind="pqrs_requester_message",
                     title=f"El solicitante respondió: {p['radicado']}", body=p["subject"], link=_pqrs_link(p))


@subscribe("pqrs.sla_alert")
async def on_sla_alert(event: Event) -> None:
    session, p, tenant = await _ctx(event)
    async with session:
        users: list[dict] = []
        if p["assignee_id"]:
            u = await identity.user_brief(session, p["assignee_id"])
            users += [u] if u else []
        if p["area_id"]:
            users += await identity.recipients(session, event.tenant_id, "pqrs.assign", p["area_id"])
        overdue = event.payload["state"] == "overdue"
        title = f"{'Vencida' if overdue else 'Por vencer'}: PQRS {p['radicado']}"
        await notify(session, event.tenant_id, users, kind="pqrs_sla", title=title, body=p["subject"],
                     link=_pqrs_link(p), email=_staff_email_on(tenant),
                     email_html=emails.layout(tenant, title, emails.p(
                         "El caso superó su fecha límite de respuesta." if overdue
                         else "El caso está próximo a vencer su tiempo de respuesta."),
                         ("Ver caso", emails.staff_link(_pqrs_link(p)))))


@subscribe("task.assigned")
async def on_task_assigned(event: Event) -> None:
    async with session_factory()() as session:
        user = await identity.user_brief(session, event.payload["assignee_id"])
        if not user:
            return
        tenant = await tenancy.get_tenant_info(session, event.tenant_id)
        title = f"Nueva tarea: {event.payload['title']}"
        link = f"/tareas/{event.payload['task_id']}"
        await notify(session, event.tenant_id, [user], kind="task_assigned", title=title,
                     body=event.payload.get("due_date"), link=link, email=_staff_email_on(tenant),
                     exclude=event.payload.get("by"),
                     email_html=emails.layout(tenant, title, emails.p(event.payload.get("description") or ""),
                                              ("Ver tarea", emails.staff_link(link))))


@subscribe("visit.completed")
async def on_visit_completed(event: Event) -> None:
    if not event.payload.get("findings"):
        return
    async with session_factory()() as session:
        users = await identity.recipients(session, event.tenant_id, "visits.manage")
        await notify(session, event.tenant_id, users, kind="visit_findings",
                     title=f"Visita con {event.payload['findings']} hallazgo(s): {event.payload.get('site_name', '')}",
                     body=event.payload.get("visitor_name"), link=f"/visitas/{event.payload['visit_id']}",
                     exclude=event.payload.get("by"))


"""Indicadores. Se calculan en Python sobre las filas de cada módulo (obtenidas por sus fachadas)."""

from __future__ import annotations

import uuid
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.catalog import public as catalog
from app.modules.clients import public as clients
from app.modules.identity import public as identity
from app.modules.pqrs import public as pqrs
from app.modules.tasks import public as tasks
from app.modules.visits import public as visits

STATUS_LABELS = {
    "received": "Radicada", "assigned": "Asignada", "in_progress": "En trámite", "on_hold": "En espera",
    "pending_approval": "En aprobación", "responded": "Respondida", "cancelled": "Anulada",
}
CHANNEL_LABELS = {"web": "Portal web", "manual": "Ventanilla", "email": "Correo", "whatsapp": "WhatsApp",
                  "integration": "Integración"}
PRIORITY_LABELS = {"urgent": "Urgente", "high": "Alta", "medium": "Media", "low": "Baja"}
SEGMENT_LABELS = {"external": "Cliente externo", "internal": "Cliente interno"}
SLA_LABELS = {"on_time": "A tiempo", "at_risk": "Por vencer", "overdue": "Vencida", "met": "Cumplida",
              "missed": "Incumplida"}


def _group(items: list, key_fn, name_fn) -> list[dict]:
    acc: dict = defaultdict(lambda: {"count": 0, "met": 0, "missed": 0, "open": 0, "overdue": 0})
    for p, state in items:
        k = key_fn(p)
        g = acc[k]
        g["count"] += 1
        if state in ("met", "missed"):
            g[state] += 1
        if p.status not in pqrs.FINAL_STATUSES:
            g["open"] += 1
        if state == "overdue":
            g["overdue"] += 1
    out = []
    for k, g in acc.items():
        closed = g["met"] + g["missed"]
        out.append({"key": str(k) if k else None, "name": name_fn(k), **g,
                    "compliance": round(g["met"] / closed * 100, 1) if closed else None})
    return sorted(out, key=lambda r: -r["count"])


async def pqrs_summary(session: AsyncSession, tenant_id: uuid.UUID, filters: dict) -> dict:
    rows = await pqrs.report_rows(session, tenant_id, filters)
    names = await catalog.names(session, tenant_id)
    areas = await identity.area_names(session, tenant_id)
    cl = await clients.names(session, tenant_id)
    users = await identity.user_names(session, {p.assignee_id for p in rows if p.assignee_id})
    items = [(p, pqrs.sla_state(p)) for p in rows]
    states = Counter(s for _, s in items if s)
    closed = states["met"] + states["missed"]
    resolved = [p for p in rows if p.resolved_at and p.status == "responded"]
    first = [p for p in rows if p.first_response_at]
    monthly: dict[str, dict] = defaultdict(lambda: {"created": 0, "responded": 0, "met": 0, "missed": 0})
    for p, state in items:
        monthly[p.created_at.strftime("%Y-%m")]["created"] += 1
        if p.resolved_at and p.status == "responded":
            m = monthly[p.resolved_at.strftime("%Y-%m")]
            m["responded"] += 1
            if state in ("met", "missed"):
                m[state] += 1
    return {
        "total": len(rows),
        "open": sum(1 for p in rows if p.status not in pqrs.FINAL_STATUSES),
        "responded": sum(1 for p in rows if p.status == "responded"),
        "cancelled": sum(1 for p in rows if p.status == "cancelled"),
        "sla": {k: states.get(k, 0) for k in SLA_LABELS},
        "compliance": round(states["met"] / closed * 100, 1) if closed else None,
        "avg_resolution_hours": round(sum((p.resolved_at - p.created_at).total_seconds() for p in resolved)
                                      / len(resolved) / 3600, 1) if resolved else None,
        "avg_first_response_hours": round(sum((p.first_response_at - p.created_at).total_seconds() for p in first)
                                          / len(first) / 3600, 1) if first else None,
        "by_status": _group(items, lambda p: p.status, lambda k: STATUS_LABELS.get(k, k)),
        "by_type": _group(items, lambda p: p.request_type_id, lambda k: names["request_types"].get(k, "—")),
        "by_category": _group(items, lambda p: p.category_id, lambda k: names["categories"].get(k, "Sin clasificar")),
        "by_area": _group(items, lambda p: p.area_id, lambda k: areas.get(k, "Sin área")),
        "by_channel": _group(items, lambda p: p.channel, lambda k: CHANNEL_LABELS.get(k, k)),
        "by_segment": _group(items, lambda p: p.segment, lambda k: SEGMENT_LABELS.get(k, k)),
        "by_priority": _group(items, lambda p: p.priority, lambda k: PRIORITY_LABELS.get(k, k)),
        "by_client": _group([i for i in items if i[0].client_id], lambda p: p.client_id,
                            lambda k: cl["clients"].get(k, "—"))[:15],
        "by_assignee": _group(items, lambda p: p.assignee_id, lambda k: users.get(k, "Sin asignar")),
        "monthly": [{"month": k, **v} for k, v in sorted(monthly.items())],
    }


async def export_rows(session: AsyncSession, tenant_id: uuid.UUID, filters: dict) -> tuple[list[str], list[list]]:
    rows = await pqrs.report_rows(session, tenant_id, filters)
    names = await catalog.names(session, tenant_id)
    areas = await identity.area_names(session, tenant_id)
    cl = await clients.names(session, tenant_id)
    users = await identity.user_names(session, {p.assignee_id for p in rows if p.assignee_id})
    header = ["Radicado", "Fecha radicación", "Segmento", "Canal", "Tipo", "Categoría", "Subcategoría", "Área",
              "Prioridad", "Estado", "Asunto", "Solicitante", "Correo", "Cliente", "Sede", "Responsable",
              "Vence", "Fecha respuesta", "Semáforo SLA"]

    def fmt(dt: datetime | None) -> str:
        return dt.astimezone(timezone(timedelta(hours=-5))).strftime("%Y-%m-%d %H:%M") if dt else ""

    data = []
    for p in rows:
        state = pqrs.sla_state(p)
        data.append([
            p.radicado, fmt(p.created_at), SEGMENT_LABELS.get(p.segment, p.segment), CHANNEL_LABELS.get(p.channel, p.channel),
            names["request_types"].get(p.request_type_id, ""), names["categories"].get(p.category_id, ""),
            names["subcategories"].get(p.subcategory_id, ""), areas.get(p.area_id, ""),
            PRIORITY_LABELS.get(p.priority, p.priority), STATUS_LABELS.get(p.status, p.status), p.subject,
            p.requester_name or ("Anónimo" if p.is_anonymous else ""), p.requester_email or "",
            cl["clients"].get(p.client_id, ""), cl["sites"].get(p.site_id, ""), users.get(p.assignee_id, ""),
            fmt(p.sla_due_at), fmt(p.resolved_at), SLA_LABELS.get(state, "") if state else "",
        ])
    return header, data


async def visits_summary(session: AsyncSession, tenant_id: uuid.UUID, month: str) -> dict:
    comp = await visits.compliance(session, tenant_id, month)
    rows = await visits.report_rows(session, tenant_id, month)
    users = await identity.user_names(session, {r["visitor_id"] for r in rows})
    by_visitor: dict = defaultdict(lambda: {"visits": 0, "findings": 0, "scores": []})
    for r in rows:
        v = by_visitor[r["visitor_id"]]
        v["visits"] += 1
        v["findings"] += r["findings"]
        if r["score"] is not None:
            v["scores"].append(r["score"])
    scores = [r["score"] for r in rows if r["score"] is not None]
    return {
        "compliance": comp,
        "total_visits": len(rows),
        "total_findings": sum(r["findings"] for r in rows),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
        "by_visitor": sorted(
            [{"name": users.get(k, "—"), "visits": v["visits"], "findings": v["findings"],
              "avg_score": round(sum(v["scores"]) / len(v["scores"]), 1) if v["scores"] else None}
             for k, v in by_visitor.items()],
            key=lambda r: -r["visits"],
        ),
    }


async def tasks_summary(session: AsyncSession, tenant_id: uuid.UUID) -> dict:
    rows = await tasks.report_rows(session, tenant_id)
    users = await identity.user_names(session, {r["assignee_id"] for r in rows if r["assignee_id"]})
    by_assignee: dict = defaultdict(lambda: {"open": 0, "done": 0, "overdue": 0})
    for r in rows:
        a = by_assignee[r["assignee_id"]]
        if r["status"] in ("open", "in_progress"):
            a["open"] += 1
        if r["status"] == "done":
            a["done"] += 1
        if r["overdue"]:
            a["overdue"] += 1
    done_on_time = [r for r in rows if r["status"] == "done" and r["due_date"] and r["completed_at"]]
    on_time = sum(1 for r in done_on_time if r["completed_at"].date() <= r["due_date"])
    return {
        "total": len(rows),
        "by_status": dict(Counter(r["status"] for r in rows)),
        "by_source": dict(Counter(r["source_type"] for r in rows)),
        "overdue": sum(1 for r in rows if r["overdue"]),
        "on_time_percent": round(on_time / len(done_on_time) * 100, 1) if done_on_time else None,
        "by_assignee": sorted([{"name": users.get(k, "Sin asignar"), **v} for k, v in by_assignee.items()],
                              key=lambda r: -(r["open"] + r["done"])),
    }


async def dashboard(session: AsyncSession, tenant_id: uuid.UUID) -> dict:
    today = date.today()
    start = datetime(today.year, today.month, 1, tzinfo=timezone.utc) - timedelta(days=150)
    summary = await pqrs_summary(session, tenant_id, {"from": start})
    month = today.strftime("%Y-%m")
    visit = await visits.compliance(session, tenant_id, month)
    task = await tasks_summary(session, tenant_id)
    return {
        "pqrs": {k: summary[k] for k in ("total", "open", "responded", "compliance", "sla", "monthly",
                                          "by_type", "by_area", "by_channel", "avg_resolution_hours")},
        "visits": {"month": month, "percent": visit["percent"], "required": visit["required"],
                   "done": visit["done_capped"], "worst": visit["rows"][:5]},
        "tasks": {"open": task["by_status"].get("open", 0) + task["by_status"].get("in_progress", 0),
                  "overdue": task["overdue"], "on_time_percent": task["on_time_percent"]},
    }

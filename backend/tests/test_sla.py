"""SLA por prioridad (inc 6): políticas (CRUD admin), vencimientos al crear, marcas de respuesta/resolución."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.api.schemas import _to_sla_out
from app.domain.models import Contact, Ticket, TicketStatus
from tests.conftest import AUTH, admin_token, bearer, create_area, create_category, create_user


def _bearer(token: str) -> dict:
    return bearer(token)


def _admin_token(client) -> str:
    return admin_token(client)


def _seed(client) -> None:
    create_area(client, "Recursos Humanos", code="rrhh")
    create_category(client, "Incapacidad", area_code="rrhh")


def _create_ticket(client) -> dict:
    r = client.post(
        "/api/tickets", headers=AUTH, json={"contact": {"wa_id": "573001112233"}, "category": "incapacidad"}
    )
    assert r.status_code == 201, r.text
    return r.json()


# --- Unit: cálculo de incumplimiento ---


def test_sla_breach_computation():
    now = datetime.now(timezone.utc)
    t = Ticket(
        id=uuid.uuid4(),
        radicado="SRV-2026-000001",
        status=TicketStatus.open,
        category_code="incapacidad",
        area_code="rrhh",
        contact=Contact(wa_id="57300"),
        created_at=now,
        updated_at=now,
        response_due_at=now - timedelta(hours=1),  # ya venció y no hubo primera respuesta
        resolution_due_at=now + timedelta(hours=1),  # aún dentro
    )
    sla = _to_sla_out(t)
    assert sla.response_breached is True
    assert sla.resolution_breached is False


# --- Políticas (CRUD admin) ---


def test_admin_upserts_and_lists_policy(client):
    tok = _admin_token(client)
    r = client.put(
        "/api/sla-policies/medium",
        headers=_bearer(tok),
        json={"response_minutes": 240, "resolution_minutes": 480},
    )
    assert r.status_code == 200, r.text
    assert r.json()["priority"] == "medium"

    listed = client.get("/api/sla-policies", headers=AUTH).json()
    assert any(p["priority"] == "medium" and p["resolution_minutes"] == 480 for p in listed)


def test_policy_resolution_lt_response_422(client):
    tok = _admin_token(client)
    r = client.put(
        "/api/sla-policies/high",
        headers=_bearer(tok),
        json={"response_minutes": 600, "resolution_minutes": 60},
    )
    assert r.status_code == 422


def test_agent_cannot_upsert_policy(client):
    create_user(client, admin_token(client), "ana@x.co", role="agent")
    tok = client.post(
        "/api/auth/login", json={"email": "ana@x.co", "password": "secret-123"}
    ).json()["access_token"]
    r = client.put(
        "/api/sla-policies/medium",
        headers=_bearer(tok),
        json={"response_minutes": 10, "resolution_minutes": 20},
    )
    assert r.status_code == 403


# --- Aplicación al ticket ---


def test_ticket_gets_due_dates_from_policy(client):
    tok = _admin_token(client)
    client.put(
        "/api/sla-policies/medium",
        headers=_bearer(tok),
        json={"response_minutes": 240, "resolution_minutes": 480},
    )
    _seed(client)
    created = _create_ticket(client)  # prioridad por defecto = media

    full = client.get(f"/api/tickets/{created['ticket_id']}", headers=AUTH).json()
    assert full["sla"]["response_due_at"] is not None
    assert full["sla"]["resolution_due_at"] is not None
    assert full["sla"]["response_breached"] is False  # recién creado, vence en el futuro


def test_ticket_marks_first_response_and_resolved(client):
    tok = _admin_token(client)
    client.put(
        "/api/sla-policies/medium",
        headers=_bearer(tok),
        json={"response_minutes": 240, "resolution_minutes": 480},
    )
    _seed(client)
    created = _create_ticket(client)
    tid = created["ticket_id"]

    client.patch(f"/api/tickets/{tid}", headers=AUTH, json={"status": "in_progress"})
    client.patch(f"/api/tickets/{tid}", headers=AUTH, json={"status": "closed"})

    full = client.get(f"/api/tickets/{tid}", headers=AUTH).json()
    assert full["sla"]["first_response_at"] is not None
    assert full["sla"]["resolved_at"] is not None


def test_ticket_without_policy_has_null_sla(client):
    # Sin política sembrada (SQLite create_all) → sin vencimientos.
    _seed(client)
    created = _create_ticket(client)
    full = client.get(f"/api/tickets/{created['ticket_id']}", headers=AUTH).json()
    assert full["sla"]["response_due_at"] is None
    assert full["sla"]["resolution_breached"] is False

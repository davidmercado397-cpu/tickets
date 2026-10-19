"""RBAC (2b): alcance por área de los agentes, gestión de catálogo solo admin/service, cola open_only."""

from __future__ import annotations

from tests.conftest import AUTH, admin_token, bearer, create_area, create_category, create_user


def _login(client, email, password="secret-123") -> str:
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _agent_token(client, email, areas) -> str:
    """Crea un agente (por el admin sembrado) y devuelve su token."""
    create_user(client, admin_token(client), email, role="agent", area_codes=areas)
    return _login(client, email)


def _create_ticket(client, category) -> dict:
    r = client.post(
        "/api/tickets", headers=AUTH, json={"contact": {"wa_id": "573001112233"}, "category": category}
    )
    assert r.status_code == 201, r.text
    return r.json()


def _setup(client) -> None:
    create_area(client, "Recursos Humanos", code="rrhh")
    create_area(client, "Contabilidad", code="conta")
    create_category(client, "Incapacidad", area_code="rrhh")  # code: incapacidad
    create_category(client, "Cuentas por Pagar", area_code="conta")  # code: cuentas_por_pagar


def test_agent_sees_only_their_area_tickets(client):
    _setup(client)
    _create_ticket(client, "incapacidad")
    _create_ticket(client, "cuentas_por_pagar")
    tok = _agent_token(client, "ana@x.co", ["rrhh"])

    page = client.get("/api/tickets", headers=bearer(tok)).json()
    assert page["total"] == 1
    assert page["items"][0]["area"] == "rrhh"


def test_admin_sees_all_tickets(client):
    _setup(client)
    _create_ticket(client, "incapacidad")
    _create_ticket(client, "cuentas_por_pagar")
    assert client.get("/api/tickets", headers=bearer(admin_token(client))).json()["total"] == 2


def test_agent_without_areas_sees_nothing(client):
    _setup(client)
    _create_ticket(client, "incapacidad")
    tok = _agent_token(client, "ana@x.co", [])
    assert client.get("/api/tickets", headers=bearer(tok)).json()["total"] == 0


def test_agent_cannot_access_ticket_outside_area(client):
    _setup(client)
    t_conta = _create_ticket(client, "cuentas_por_pagar")
    tok = _agent_token(client, "ana@x.co", ["rrhh"])

    tid = t_conta["ticket_id"]
    assert client.get(f"/api/tickets/{tid}", headers=bearer(tok)).status_code == 404
    patch = client.patch(
        f"/api/tickets/{tid}", headers=bearer(tok), json={"status": "in_progress"}
    )
    assert patch.status_code == 404


def test_agent_can_access_ticket_in_area(client):
    _setup(client)
    t = _create_ticket(client, "incapacidad")
    tok = _agent_token(client, "ana@x.co", ["rrhh"])

    tid = t["ticket_id"]
    assert client.get(f"/api/tickets/{tid}", headers=bearer(tok)).status_code == 200
    r = client.patch(
        f"/api/tickets/{tid}", headers=bearer(tok), json={"status": "in_progress"}
    )
    assert r.status_code == 200 and r.json()["status"] == "in_progress"


def test_agent_can_read_but_not_manage_catalog(client):
    _setup(client)
    tok = _agent_token(client, "ana@x.co", ["rrhh"])
    assert client.get("/api/areas", headers=bearer(tok)).status_code == 200
    assert client.post("/api/areas", headers=bearer(tok), json={"name": "Nueva"}).status_code == 403


def test_open_only_queue_filter(client):
    _setup(client)
    t = _create_ticket(client, "incapacidad")
    client.patch(f"/api/tickets/{t['ticket_id']}", headers=AUTH, json={"status": "closed"})
    tok = _agent_token(client, "ana@x.co", ["rrhh"])

    assert client.get("/api/tickets", headers=bearer(tok)).json()["total"] == 1
    queue = client.get("/api/tickets", headers=bearer(tok), params={"open_only": True}).json()
    assert queue["total"] == 0

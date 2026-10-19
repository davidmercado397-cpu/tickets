"""Empleados (inc 4): CRUD por admin/service, consulta por documento (bot), búsqueda, RBAC."""

from __future__ import annotations

from tests.conftest import AUTH, admin_token, bearer, create_user


def _bearer(token: str) -> dict:
    return bearer(token)


def _create_emp(client, document="12345", full_name="Juan Pérez", **extra) -> dict:
    body = {"document": document, "full_name": full_name, **extra}
    r = client.post("/api/employees", headers=AUTH, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_and_get_employee(client):
    _create_emp(
        client,
        document="12345",
        full_name="Juan Pérez",
        position="Analista",
        hire_date="2020-01-15",
        contract_type="indefinido",
        status="activo",
        data={"prorrogas": 2},
    )
    emp = client.get("/api/employees/12345", headers=AUTH).json()
    assert emp["full_name"] == "Juan Pérez"
    assert emp["position"] == "Analista"
    assert emp["hire_date"] == "2020-01-15"
    assert emp["status"] == "activo"
    assert emp["data"] == {"prorrogas": 2}


def test_get_unknown_employee_404(client):
    assert client.get("/api/employees/99999", headers=AUTH).status_code == 404


def test_duplicate_document_409(client):
    _create_emp(client, document="12345")
    r = client.post(
        "/api/employees", headers=AUTH, json={"document": "12345", "full_name": "Otro"}
    )
    assert r.status_code == 409


def test_list_and_search(client):
    _create_emp(client, document="111", full_name="Ana Gómez")
    _create_emp(client, document="222", full_name="Beto Ruiz")
    page = client.get("/api/employees", headers=AUTH).json()
    assert page["total"] == 2

    found = client.get("/api/employees", headers=AUTH, params={"q": "Ana"}).json()
    assert found["total"] == 1
    assert found["items"][0]["full_name"] == "Ana Gómez"


def test_update_employee(client):
    _create_emp(client, document="12345", status="activo")
    r = client.patch(
        "/api/employees/12345", headers=AUTH, json={"status": "retirado", "position": "Coordinador"}
    )
    assert r.status_code == 200
    assert r.json()["status"] == "retirado"
    assert r.json()["position"] == "Coordinador"


def test_update_unknown_employee_404(client):
    r = client.patch("/api/employees/99999", headers=AUTH, json={"status": "retirado"})
    assert r.status_code == 404


def test_agent_can_read_but_not_manage(client):
    _create_emp(client, document="12345")
    # Un agente (JWT) puede consultar por documento (lo necesitan los flujos), pero no gestionar.
    create_user(client, admin_token(client), "ana@x.co", role="agent")
    tok = client.post(
        "/api/auth/login", json={"email": "ana@x.co", "password": "secret-123"}
    ).json()["access_token"]

    assert client.get("/api/employees/12345", headers=_bearer(tok)).status_code == 200
    forbidden = client.post(
        "/api/employees", headers=_bearer(tok), json={"document": "999", "full_name": "X"}
    )
    assert forbidden.status_code == 403

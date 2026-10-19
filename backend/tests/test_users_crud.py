"""Gestión de usuarios in-app por admin (/api/users): crear, listar, actualizar rol/áreas/estado/pass."""

from __future__ import annotations

from tests.conftest import AUTH, SEED_ADMIN_EMAIL, admin_token, bearer, create_area, create_user


def test_admin_creates_agent_and_lists(client):
    create_area(client, "Recursos Humanos", code="rrhh")
    tok = admin_token(client)
    agent = create_user(client, tok, "ana@x.co", role="agent", area_codes=["rrhh"])
    assert agent["role"] == "agent"
    assert agent["area_codes"] == ["rrhh"]

    emails = {u["email"] for u in client.get("/api/users", headers=bearer(tok)).json()}
    assert {SEED_ADMIN_EMAIL, "ana@x.co"} <= emails


def test_admin_updates_role_areas_and_status(client):
    create_area(client, "Recursos Humanos", code="rrhh")
    create_area(client, "Contabilidad", code="conta")
    tok = admin_token(client)
    ana = create_user(client, tok, "ana@x.co", role="agent", area_codes=["rrhh"])
    uid = ana["id"]

    r = client.patch(f"/api/users/{uid}", headers=bearer(tok), json={"area_codes": ["conta"]})
    assert r.json()["area_codes"] == ["conta"]
    r = client.patch(f"/api/users/{uid}", headers=bearer(tok), json={"role": "admin"})
    assert r.json()["role"] == "admin"
    r = client.patch(f"/api/users/{uid}", headers=bearer(tok), json={"active": False})
    assert r.json()["active"] is False


def test_admin_resets_password(client):
    tok = admin_token(client)
    ana = create_user(client, tok, "ana@x.co", password="old-secret-1", role="agent")

    r = client.patch(
        f"/api/users/{ana['id']}", headers=bearer(tok), json={"password": "new-secret-2"}
    )
    assert r.status_code == 200
    assert (
        client.post("/api/auth/login", json={"email": "ana@x.co", "password": "new-secret-2"}).status_code
        == 200
    )
    assert (
        client.post("/api/auth/login", json={"email": "ana@x.co", "password": "old-secret-1"}).status_code
        == 401
    )


def test_agent_cannot_access_users_endpoint(client):
    tok = admin_token(client)
    create_user(client, tok, "ana@x.co", role="agent")
    agent_tok = client.post(
        "/api/auth/login", json={"email": "ana@x.co", "password": "secret-123"}
    ).json()["access_token"]
    assert client.get("/api/users", headers=bearer(agent_tok)).status_code == 403


def test_service_token_cannot_access_users(client):
    # El service-token del bot no es un JWT de usuario → 401 en /api/users.
    assert client.get("/api/users", headers=AUTH).status_code == 401


def test_update_unknown_area_422(client):
    tok = admin_token(client)
    ana = create_user(client, tok, "ana@x.co", role="agent")
    r = client.patch(
        f"/api/users/{ana['id']}", headers=bearer(tok), json={"area_codes": ["no_existe"]}
    )
    assert r.status_code == 422


def test_update_nonexistent_user_404(client):
    tok = admin_token(client)
    r = client.patch(
        "/api/users/00000000-0000-0000-0000-000000000000",
        headers=bearer(tok),
        json={"active": False},
    )
    assert r.status_code == 404

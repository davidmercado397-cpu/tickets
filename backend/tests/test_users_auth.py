"""Auth de usuarios: admin sembrado, login/JWT, /me, creación vía /api/users (admin)."""

from __future__ import annotations

from tests.conftest import (
    SEED_ADMIN_EMAIL,
    admin_token,
    bearer,
    create_area,
    create_user,
)


def test_seeded_admin_login_and_me(client):
    tok = admin_token(client)
    me = client.get("/api/auth/me", headers=bearer(tok))
    assert me.status_code == 200
    assert me.json()["email"] == SEED_ADMIN_EMAIL
    assert me.json()["role"] == "admin"


def test_admin_creates_agent_who_can_login(client):
    create_area(client, "Recursos Humanos", code="rrhh")
    tok = admin_token(client)
    user = create_user(client, tok, "ana@acme.co", role="agent", area_codes=["rrhh"])
    assert user["role"] == "agent"
    assert user["area_codes"] == ["rrhh"]
    assert "password" not in user and "password_hash" not in user

    r = client.post("/api/auth/login", json={"email": "ana@acme.co", "password": "secret-123"})
    assert r.status_code == 200


def test_login_wrong_password_401(client):
    r = client.post(
        "/api/auth/login", json={"email": SEED_ADMIN_EMAIL, "password": "wrong"}
    )
    assert r.status_code == 401


def test_me_without_token_401(client):
    assert client.get("/api/auth/me").status_code == 401


def test_duplicate_email_409(client):
    tok = admin_token(client)
    create_user(client, tok, "ana@acme.co", role="admin")
    r = client.post(
        "/api/users",
        headers=bearer(tok),
        json={"email": "ANA@acme.co", "password": "other-123", "role": "agent"},
    )
    assert r.status_code == 409  # email normalizado


def test_short_password_422(client):
    tok = admin_token(client)
    r = client.post(
        "/api/users",
        headers=bearer(tok),
        json={"email": "ana@acme.co", "password": "short", "role": "admin"},
    )
    assert r.status_code == 422


def test_unknown_area_422(client):
    tok = admin_token(client)
    r = client.post(
        "/api/users",
        headers=bearer(tok),
        json={"email": "ana@acme.co", "password": "secret-123", "role": "agent", "area_codes": ["nope"]},
    )
    assert r.status_code == 422


def test_email_is_normalized_on_login(client):
    tok = admin_token(client)
    create_user(client, tok, "Ana@Acme.CO", role="admin")
    r = client.post("/api/auth/login", json={"email": "ana@acme.co", "password": "secret-123"})
    assert r.status_code == 200

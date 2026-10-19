"""Auth por service-token: sin token o con token inválido → 401."""

from __future__ import annotations

from tests.conftest import AUTH


def test_missing_token_returns_401(client):
    assert client.get("/api/areas").status_code == 401
    assert client.post("/api/tickets", json={}).status_code == 401


def test_wrong_token_returns_401(client):
    r = client.get("/api/areas", headers={"Authorization": "Bearer mal-token"})
    assert r.status_code == 401


def test_valid_token_passes(client):
    assert client.get("/api/areas", headers=AUTH).status_code == 200

"""Fixtures: SQLite de archivo + fakeredis + almacenamiento en memoria. No requieren servicios reales."""

from __future__ import annotations

import json

import fakeredis.aioredis
import pytest
from fastapi.testclient import TestClient

SUPER = ("super@plataforma.co", "super-secreto-123")
ADMIN = ("admin@demo.nextbyte.com.co", "admin-secreto-123")


@pytest.fixture
def client(monkeypatch, tmp_path):
    from app.core.config import get_settings

    env = {
        "DATABASE_URL": f"sqlite+aiosqlite:///{tmp_path}/app.db",
        "AUTH_JWT_SIGNING_KEY": "test-jwt-signing-key-0123456789-abcdefghij",
        "SEED_SUPERADMIN_EMAIL": SUPER[0],
        "SEED_SUPERADMIN_PASSWORD": SUPER[1],
        "SEED_DEMO_TENANT": "true",
        "SEED_DEMO_ADMIN_EMAIL": ADMIN[0],
        "SEED_DEMO_ADMIN_PASSWORD": ADMIN[1],
        "LOG_FORMAT": "text",
        "S3_ENDPOINT_URL": "",
        "SMTP_HOST": "",
        "SECRETS_ENCRYPTION_KEY": "Zm9vYmFyYmF6cXV4cXV1eGZvb2JhcmJhenF1eHF1dXg=",
    }
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr("redis.asyncio.from_url", lambda *a, **k: fake)
    get_settings.cache_clear()
    from app.main import app

    with TestClient(app) as c:
        c.fake_redis = fake  # type: ignore[attr-defined]
        yield c
    get_settings.cache_clear()


def login(client: TestClient, email: str, password: str) -> dict:
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def admin(client) -> dict:
    return login(client, *ADMIN)


@pytest.fixture
def superadmin(client) -> dict:
    return login(client, *SUPER)


def catalog_ids(
    client: TestClient, headers: dict, segment: str = "external", type_code: str = "reclamo"
) -> tuple[str, str, str]:
    types = client.get("/api/catalog/request-types", headers=headers).json()
    queja = next(t for t in types if t["code"] == type_code)["id"]
    cats = client.get(f"/api/catalog/categories?segment={segment}", headers=headers).json()
    cat = next(c for c in cats if c["request_type_id"] is None)
    return queja, cat["id"], cat["subcategories"][0]["id"]


def make_client_site(client: TestClient, headers: dict, nit: str = "900.123.456-7") -> tuple[dict, dict]:
    r = client.post("/api/clients", headers=headers, json={"nit": nit, "name": "Conjunto Los Robles",
                                                           "contact_email": "admin@robles.co"})
    assert r.status_code == 201, r.text
    c = r.json()
    r = client.post(f"/api/clients/{c['id']}/sites", headers=headers, json={"name": "Portería principal"})
    assert r.status_code == 201, r.text
    return c, r.json()


def public_create(client: TestClient, payload: dict, files=None):
    return client.post("/api/public/tenants/demo/pqrs", data={"data": json.dumps(payload)}, files=files)

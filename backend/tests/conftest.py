"""Fixtures comunes de los tests.

Los tests corren sobre SQLite async (aiosqlite): NO necesitan PostgreSQL ni Redis reales. El lifespan
de la app crea el esquema con create_all sobre el SQLite de archivo."""

from __future__ import annotations

import fakeredis.aioredis
import pytest
from fastapi.testclient import TestClient

from app.main import app

# Token de servicio determinista para los tests (auth del bot).
SERVICE_TOKEN = "test-service-token"
AUTH = {"Authorization": f"Bearer {SERVICE_TOKEN}"}
# Admin sembrado en el arranque (bootstrap sin endpoint operador).
SEED_ADMIN_EMAIL = "seed-admin@test.co"
SEED_ADMIN_PASSWORD = "seed-admin-123"


@pytest.fixture
def app_env(monkeypatch, tmp_path):
    """Configura el entorno mínimo para arrancar la app con SQLite de archivo."""
    from app.config import get_settings

    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path}/app.db")
    monkeypatch.setenv("TICKETING_SERVICE_TOKEN", SERVICE_TOKEN)
    monkeypatch.setenv("RADICADO_PREFIX", "SRV")
    monkeypatch.setenv("API_PREFIX", "/api")
    monkeypatch.setenv("LOG_FORMAT", "text")
    monkeypatch.setenv("AUTH_JWT_SIGNING_KEY", "test-jwt-signing-key-0123456789-abcdefghij")
    monkeypatch.setenv("SEED_ADMIN_EMAIL", SEED_ADMIN_EMAIL)
    monkeypatch.setenv("SEED_ADMIN_PASSWORD", SEED_ADMIN_PASSWORD)
    # Redis del bus SSE → fakeredis (sin Redis real en los tests).
    monkeypatch.setattr(
        "redis.asyncio.from_url",
        lambda *a, **k: fakeredis.aioredis.FakeRedis(decode_responses=True),
    )
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client(app_env):
    """TestClient con el lifespan real (crea el esquema SQLite + siembra el admin al entrar)."""
    with TestClient(app) as c:
        yield c


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def admin_token(client: TestClient) -> str:
    """Login como el admin sembrado; devuelve su JWT."""
    r = client.post(
        "/api/auth/login", json={"email": SEED_ADMIN_EMAIL, "password": SEED_ADMIN_PASSWORD}
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def create_user(
    client: TestClient,
    token: str,
    email: str,
    password: str = "secret-123",
    role: str = "agent",
    area_codes: list[str] | None = None,
    phone: str | None = None,
) -> dict:
    """Crea un usuario vía /api/users (requiere un token de admin)."""
    body: dict = {"email": email, "password": password, "role": role}
    if area_codes is not None:
        body["area_codes"] = area_codes
    if phone is not None:
        body["phone"] = phone
    r = client.post("/api/users", headers=bearer(token), json=body)
    assert r.status_code == 201, r.text
    return r.json()


def create_area(client: TestClient, name: str, code: str | None = None) -> dict:
    body: dict = {"name": name}
    if code is not None:
        body["code"] = code
    r = client.post("/api/areas", headers=AUTH, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def create_category(client: TestClient, name: str, area_code: str, code: str | None = None) -> dict:
    body: dict = {"name": name, "area": area_code}
    if code is not None:
        body["code"] = code
    r = client.post("/api/categories", headers=AUTH, json=body)
    assert r.status_code == 201, r.text
    return r.json()

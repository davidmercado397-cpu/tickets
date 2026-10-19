"""Certificado laboral (inc 5): emisión E2E con FakeObjectStorage, registro como ticket, 404/422/503."""

from __future__ import annotations

import pytest

from app.main import app
from tests.conftest import AUTH, create_area, create_category


class FakeObjectStorage:
    """ObjectStorage en memoria: guarda bytes y devuelve una URL 'firmada' de mentira."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = data

    async def signed_url(self, key: str, ttl_seconds: int) -> str:
        return f"https://fake-r2.local/{key}?sig=abc&ttl={ttl_seconds}"


@pytest.fixture
def fake_storage():
    from app.dependencies import get_object_storage

    fake = FakeObjectStorage()
    app.dependency_overrides[get_object_storage] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_object_storage, None)


def _seed_catalog(client) -> None:
    create_area(client, "Recursos Humanos", code="rrhh")
    create_category(client, "Certificado Laboral", area_code="rrhh", code="certificado_laboral")


def _create_employee(client, document="94313648") -> None:
    r = client.post(
        "/api/employees",
        headers=AUTH,
        json={
            "document": document,
            "full_name": "Varela Rodriguez Daimer",
            "position": "Escolta",
            "hire_date": "2023-08-15",
            "contract_type": "Fijo inferior a un año",
            "status": "activo",
        },
    )
    assert r.status_code == 201, r.text


def _request_cert(client, document="94313648"):
    return client.post(
        f"/api/employees/{document}/certificate",
        headers=AUTH,
        json={"contact": {"wa_id": "573001112233"}, "conversation_id": "conv-1"},
    )


def test_emit_certificate_e2e(client, fake_storage):
    _seed_catalog(client)
    _create_employee(client)

    r = _request_cert(client)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["url"].startswith("https://fake-r2.local/certificates/94313648/")
    assert body["radicado"].startswith("SRV-")
    assert body["status"] == "open"

    # Se guardó un PDF en el storage.
    assert len(fake_storage.objects) == 1
    assert next(iter(fake_storage.objects.values()))[:4] == b"%PDF"

    # Quedó registrado como ticket certificado_laboral (área derivada rrhh).
    ticket = client.get(f"/api/tickets/by-radicado/{body['radicado']}", headers=AUTH).json()
    assert ticket["category"] == "certificado_laboral"
    assert ticket["area"] == "rrhh"

    # El bot lo cierra tras enviar el PDF (reusa PATCH).
    closed = client.patch(
        f"/api/tickets/{body['ticket_id']}", headers=AUTH, json={"status": "closed"}
    )
    assert closed.status_code == 200 and closed.json()["status"] == "closed"


def test_unknown_employee_404(client, fake_storage):
    _seed_catalog(client)
    assert _request_cert(client, document="00000").status_code == 404


def test_missing_category_422(client, fake_storage):
    # Empleado existe pero la categoría certificado_laboral NO está en el catálogo.
    _create_employee(client)
    assert _request_cert(client).status_code == 422


def test_without_r2_configured_503(client):
    # Sin el override de storage → app.state.object_storage es None (R2 no configurado) → 503.
    _seed_catalog(client)
    _create_employee(client)
    assert _request_cert(client).status_code == 503

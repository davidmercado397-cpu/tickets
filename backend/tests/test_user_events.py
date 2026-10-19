"""Evento de vuelta al usuario (inc 7): al cambiar a un estado que dispara, se llama al /send del Gateway."""

from __future__ import annotations

import pytest

from app.main import app
from tests.conftest import AUTH, create_area, create_category


class FakeGateway:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def send_template(self, *, to, template, language, body_params) -> None:
        self.calls.append({"to": to, "template": template, "body_params": body_params})


@pytest.fixture
def spy_gateway():
    from app.dependencies import get_user_event_notifier
    from app.services.user_events import UserEventNotifier

    fake = FakeGateway()
    # Notificador real (con la lógica de decisión) sobre un Gateway falso; dispara al cerrar.
    notifier = UserEventNotifier(fake, "caso_actualizado", "es", {"closed"})
    app.dependency_overrides[get_user_event_notifier] = lambda: notifier
    yield fake
    app.dependency_overrides.pop(get_user_event_notifier, None)


def _seed(client) -> None:
    create_area(client, "Recursos Humanos", code="rrhh")
    create_category(client, "Incapacidad", area_code="rrhh")


def _create_ticket(client) -> dict:
    r = client.post(
        "/api/tickets", headers=AUTH, json={"contact": {"wa_id": "573001112233"}, "category": "incapacidad"}
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_return_event_fires_on_trigger_status(client, spy_gateway):
    _seed(client)
    created = _create_ticket(client)
    tid = created["ticket_id"]

    # Estado que NO dispara → sin envío.
    client.patch(f"/api/tickets/{tid}", headers=AUTH, json={"status": "in_progress"})
    assert spy_gateway.calls == []

    # Cierre → evento de vuelta al solicitante.
    client.patch(f"/api/tickets/{tid}", headers=AUTH, json={"status": "closed"})
    assert len(spy_gateway.calls) == 1
    assert spy_gateway.calls[0]["to"] == "573001112233"
    assert spy_gateway.calls[0]["body_params"][0] == created["radicado"]


def test_no_duplicate_when_status_unchanged(client, spy_gateway):
    _seed(client)
    created = _create_ticket(client)
    tid = created["ticket_id"]

    client.patch(f"/api/tickets/{tid}", headers=AUTH, json={"status": "closed"})
    client.patch(f"/api/tickets/{tid}", headers=AUTH, json={"status": "closed", "note": "recordatorio"})
    assert len(spy_gateway.calls) == 1  # el 2º PATCH no cambió el estado → no reenvía


def test_disabled_by_default_no_send(client):
    # Sin override ni config → gateway None → no se intenta enviar (y no rompe el PATCH).
    _seed(client)
    created = _create_ticket(client)
    r = client.patch(
        f"/api/tickets/{created['ticket_id']}", headers=AUTH, json={"status": "closed"}
    )
    assert r.status_code == 200

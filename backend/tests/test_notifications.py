"""Notificaciones (inc 3): in-app al grupo del área, al asignado, feed/mark-read, canal externo, SSE."""

from __future__ import annotations

from app.main import app
from tests.conftest import AUTH, admin_token, bearer, create_area, create_category, create_user


def _make_user(client, email, role="agent", areas=None, phone=None) -> dict:
    return create_user(
        client, admin_token(client), email, role=role, area_codes=areas, phone=phone
    )


def _login(client, email) -> str:
    r = client.post("/api/auth/login", json={"email": email, "password": "secret-123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _create_ticket(client, category="incapacidad") -> dict:
    r = client.post(
        "/api/tickets", headers=AUTH, json={"contact": {"wa_id": "573001112233"}, "category": category}
    )
    assert r.status_code == 201, r.text
    return r.json()


def _seed(client) -> None:
    create_area(client, "Recursos Humanos", code="rrhh")
    create_category(client, "Incapacidad", area_code="rrhh")


def test_ticket_created_notifies_area_group(client):
    _seed(client)
    _make_user(client, "ana@x.co", areas=["rrhh"])
    _create_ticket(client)

    tok = _login(client, "ana@x.co")
    feed = client.get("/api/notifications", headers=bearer(tok)).json()
    assert len(feed) == 1
    assert feed[0]["type"] == "ticket_created"
    assert feed[0]["radicado"].startswith("SRV-")
    assert client.get("/api/notifications/unread-count", headers=bearer(tok)).json()["count"] == 1


def test_agent_in_other_area_not_notified(client):
    _seed(client)
    create_area(client, "Contabilidad", code="conta")
    _make_user(client, "beto@x.co", areas=["conta"])
    _create_ticket(client)  # área rrhh

    tok = _login(client, "beto@x.co")
    assert client.get("/api/notifications", headers=bearer(tok)).json() == []


def test_mark_read_and_read_all(client):
    _seed(client)
    _make_user(client, "ana@x.co", areas=["rrhh"])
    _create_ticket(client)
    tok = _login(client, "ana@x.co")

    notif = client.get("/api/notifications", headers=bearer(tok)).json()[0]
    assert client.post(
        f"/api/notifications/{notif['id']}/read", headers=bearer(tok)
    ).status_code == 200
    assert client.get("/api/notifications/unread-count", headers=bearer(tok)).json()["count"] == 0

    _create_ticket(client)
    marked = client.post("/api/notifications/read-all", headers=bearer(tok)).json()["marked"]
    assert marked == 1
    assert client.get("/api/notifications/unread-count", headers=bearer(tok)).json()["count"] == 0


def test_assigned_notifies_that_user(client):
    _seed(client)
    create_area(client, "Contabilidad", code="conta")
    # carla NO está en rrhh (no recibe el 'created'); se le ASIGNA el ticket.
    _make_user(client, "carla@x.co", areas=["conta"])
    ticket = _create_ticket(client)

    r = client.patch(
        f"/api/tickets/{ticket['ticket_id']}",
        headers=bearer(admin_token(client)),
        json={"assignee": "carla@x.co", "status": "assigned"},
    )
    assert r.status_code == 200

    carla_tok = _login(client, "carla@x.co")
    feed = client.get("/api/notifications", headers=bearer(carla_tok)).json()
    assert len(feed) == 1
    assert feed[0]["type"] == "ticket_assigned"


def test_stream_requires_auth(client):
    # require_user devuelve 401 ANTES de abrir el stream (no cuelga).
    assert client.get("/api/notifications/stream").status_code == 401


def test_external_channel_is_dispatched(client):
    from app.dependencies import get_external_channels

    class SpyChannel:
        name = "spy"

        def __init__(self) -> None:
            self.sent: list = []

        def applies(self, user) -> bool:
            return True

        async def send(self, notification, user) -> None:
            self.sent.append((notification.type.value, user.email))

    spy = SpyChannel()
    app.dependency_overrides[get_external_channels] = lambda: [spy]
    try:
        _seed(client)
        _make_user(client, "ana@x.co", areas=["rrhh"], phone="573001112233")
        _create_ticket(client)
        # BackgroundTasks corren de forma síncrona en TestClient → el spy ya recibió.
        assert spy.sent == [("ticket_created", "ana@x.co")]
    finally:
        app.dependency_overrides.pop(get_external_channels, None)

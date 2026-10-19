"""Unit tests de los canales externos y el cliente del Gateway (sin la app completa)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import httpx
import respx

from app.adapters.gateway_client import HttpGatewayClient
from app.domain.models import Notification, NotificationType, Role, User
from app.services.notifications import EmailChannel, WhatsAppChannel


def _notif() -> Notification:
    return Notification(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        type=NotificationType.ticket_created,
        title="Nuevo caso en RRHH",
        created_at=datetime.now(timezone.utc),
        radicado="SRV-2026-000001",
    )


def _user(phone: str | None) -> User:
    now = datetime.now(timezone.utc)
    return User(
        id=uuid.uuid4(),
        email="ana@x.co",
        role=Role.agent,
        active=True,
        created_at=now,
        updated_at=now,
        phone=phone,
        area_codes=["rrhh"],
    )


class _FakeGateway:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def send_template(self, *, to, template, language, body_params) -> None:
        self.calls.append(
            {"to": to, "template": template, "language": language, "body_params": body_params}
        )


class _FakeSender:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send(self, *, to, subject, body) -> None:
        self.sent.append({"to": to, "subject": subject, "body": body})


def test_whatsapp_channel_requires_phone():
    ch = WhatsAppChannel(_FakeGateway(), "tmpl", "es")
    assert ch.applies(_user("573001112233")) is True
    assert ch.applies(_user(None)) is False


async def test_whatsapp_channel_sends_template():
    gw = _FakeGateway()
    ch = WhatsAppChannel(gw, "nuevo_caso", "es")
    await ch.send(_notif(), _user("573001112233"))
    assert gw.calls == [
        {
            "to": "573001112233",
            "template": "nuevo_caso",
            "language": "es",
            "body_params": ["SRV-2026-000001", "Nuevo caso en RRHH"],
        }
    ]


async def test_email_channel_sends():
    sender = _FakeSender()
    await EmailChannel(sender).send(_notif(), _user(None))
    assert sender.sent[0]["to"] == "ana@x.co"
    assert sender.sent[0]["subject"] == "Nuevo caso en RRHH"


@respx.mock
async def test_gateway_client_posts_template():
    route = respx.post("https://gw.test/send").mock(
        return_value=httpx.Response(200, json={"messages": [{"id": "wamid.X"}]})
    )
    async with httpx.AsyncClient() as client:
        gw = HttpGatewayClient(client, "https://gw.test", "internal-key", "PN1")
        await gw.send_template(to="573", template="t", language="es", body_params=["a", "b"])

    assert route.called
    req = route.calls[0].request
    body = json.loads(req.content)
    assert body["type"] == "template"
    assert body["to"] == "573"
    assert body["name"] == "t"
    assert body["phone_number_id"] == "PN1"
    assert body["components"][0]["parameters"] == [
        {"type": "text", "text": "a"},
        {"type": "text", "text": "b"},
    ]
    assert req.headers["X-Internal-Key"] == "internal-key"

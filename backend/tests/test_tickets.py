"""Tickets: crear (deriva área + radicado), hint incoherente, adjuntos, by-radicado, patch, listado."""

from __future__ import annotations

from tests.conftest import AUTH, create_area, create_category


def _seed(client) -> None:
    """Catálogo mínimo: área rrhh + categoría incapacidad."""
    create_area(client, "Recursos Humanos", code="rrhh")
    create_category(client, "Incapacidad", area_code="rrhh")


def _create_ticket(client, **overrides) -> dict:
    body = {
        "contact": {"wa_id": "573001112233", "name": "Juan Pérez", "document": "123456"},
        "category": "incapacidad",
        "conversation_id": "5b9c0d2e-1111-2222-3333-444455556666",
    }
    body.update(overrides)
    r = client.post("/api/tickets", headers=AUTH, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_ticket_derives_area_and_radicado(client):
    _seed(client)
    created = _create_ticket(client)
    assert created["radicado"].startswith("SRV-")
    assert created["status"] == "open"
    assert "ticket_id" in created

    full = client.get(f"/api/tickets/by-radicado/{created['radicado']}", headers=AUTH).json()
    assert full["category"] == "incapacidad"
    assert full["area"] == "rrhh"  # derivada de la categoría
    assert full["area_name"] == "Recursos Humanos"
    assert len(full["history"]) == 1
    assert full["history"][0]["status"] == "open"


def test_create_ticket_unknown_category_returns_422(client):
    _seed(client)
    r = client.post(
        "/api/tickets",
        headers=AUTH,
        json={"contact": {"wa_id": "573001112233"}, "category": "no_existe"},
    )
    assert r.status_code == 422


def test_area_hint_mismatch_does_not_fail_and_uses_category_area(client):
    _seed(client)
    create_area(client, "Contabilidad", code="conta")
    # El bot manda un área que NO corresponde a la categoría: se acepta y se usa la de la categoría.
    created = _create_ticket(client, area="conta")
    full = client.get(f"/api/tickets/by-radicado/{created['radicado']}", headers=AUTH).json()
    assert full["area"] == "rrhh"


def test_attachment_is_reflected_on_read(client):
    _seed(client)
    created = _create_ticket(
        client,
        attachments=[
            {"url": "https://r2.example/org/soporte.pdf", "mime": "application/pdf", "name": "soporte.pdf"}
        ],
    )
    full = client.get(f"/api/tickets/{created['ticket_id']}", headers=AUTH).json()
    assert len(full["attachments"]) == 1
    assert full["attachments"][0]["url"] == "https://r2.example/org/soporte.pdf"


def test_patch_changes_status_and_appends_history(client):
    _seed(client)
    created = _create_ticket(client)
    r = client.patch(
        f"/api/tickets/{created['ticket_id']}",
        headers=AUTH,
        json={"status": "in_progress", "assignee": "ana", "note": "En trámite"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "in_progress"
    assert body["assignee"] == "ana"
    assert len(body["history"]) == 2
    assert body["history"][-1]["status"] == "in_progress"


def test_radicado_is_unique_and_incremental(client):
    _seed(client)
    r1 = _create_ticket(client)
    r2 = _create_ticket(client)
    assert r1["radicado"] != r2["radicado"]


def test_list_filters_by_status_and_paginates(client):
    _seed(client)
    _create_ticket(client)
    t2 = _create_ticket(client)
    client.patch(
        f"/api/tickets/{t2['ticket_id']}", headers=AUTH, json={"status": "closed"}
    )

    page = client.get("/api/tickets", headers=AUTH).json()
    assert page["total"] == 2
    assert page["page"] == 1

    closed_page = client.get(
        "/api/tickets", headers=AUTH, params={"status": "closed"}
    ).json()
    assert closed_page["total"] == 1
    assert closed_page["items"][0]["status"] == "closed"


def test_get_unknown_ticket_returns_404(client):
    _seed(client)
    r = client.get(
        "/api/tickets/00000000-0000-0000-0000-000000000000", headers=AUTH
    )
    assert r.status_code == 404


def test_by_radicado_unknown_returns_404(client):
    _seed(client)
    assert client.get("/api/tickets/by-radicado/NOPE-2026-000001", headers=AUTH).status_code == 404

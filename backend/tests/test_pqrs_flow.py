from __future__ import annotations

import json

from tests.conftest import catalog_ids, login, make_client_site, public_create


def test_platform_creates_tenant_with_seeded_config(client, superadmin):
    r = client.post("/api/platform/tenants", headers=superadmin, json={
        "name": "Seguridad Andina", "radicado_prefix": "SAN", "admin_email": "admin@andina.co",
        "admin_full_name": "Admin Andina", "admin_password": "andina-secreto-1",
    })
    assert r.status_code == 201, r.text
    h = login(client, "admin@andina.co", "andina-secreto-1")
    me = client.get("/api/auth/me", headers=h).json()
    assert me["tenant"]["slug"] == "seguridad-andina"
    assert "pqrs.approve" in me["permissions"]
    roles = {r["code"] for r in client.get("/api/roles", headers=h).json()}
    assert {"admin", "radicador", "gestor", "aprobador", "jefe_operacion", "auditor"} <= roles
    policies = client.get("/api/sla/policies", headers=h).json()
    assert {p["priority"]: (p["target_value"], p["unit"]) for p in policies}["medium"] == (15, "business_days")
    # Aislamiento: la empresa nueva no ve catálogos/clientes de Servigpoder.
    assert client.get("/api/clients", headers=h).json() == []


def test_public_portal_full_lifecycle(client, admin):
    rt, cat, sub = catalog_ids(client, admin)
    c, site = make_client_site(client, admin)
    lookup = client.get("/api/public/tenants/servigpoder/clients/lookup?nit=900123456-7")
    assert lookup.status_code == 200 and lookup.json()["sites"][0]["id"] == site["id"]

    r = public_create(client, {
        "segment": "external", "request_type_id": rt, "category_id": cat, "subcategory_id": sub,
        "subject": "Vigilante ausente en la noche", "description": "El puesto estuvo solo entre 2 y 4 am.",
        "client_id": c["id"], "site_id": site["id"], "consent": True,
        "requester": {"name": "Ana Torres", "email": "ana@robles.co"},
    }, files=[("files", ("evidencia.txt", b"hola", "text/plain"))])
    assert r.status_code == 201, r.text
    radicado, code = r.json()["radicado"], r.json()["public_code"]
    assert radicado.startswith("SGP-")

    page = client.get("/api/pqrs?open_only=true", headers=admin).json()
    case = next(i for i in page["items"] if i["radicado"] == radicado)
    assert case["area"]["name"] == "Operaciones"  # sugerida por la categoría
    assert case["priority"] == "high" and case["sla_state"] == "on_time"
    pid = case["id"]

    users = client.get("/api/users/lookup?permission=pqrs.manage", headers=admin).json()
    r = client.post(f"/api/pqrs/{pid}/assign", headers=admin, json={"assignee_id": users[0]["id"]})
    assert r.json()["status"] == "assigned"

    r = client.post(f"/api/pqrs/{pid}/status", headers=admin, json={"status": "on_hold", "note": "Envíe la minuta"})
    assert r.status_code == 200 and r.json()["sla"]["paused"] is True
    # El solicitante responde desde el portal → se reanuda.
    r = client.post(f"/api/public/tenants/servigpoder/pqrs/{radicado}/messages",
                    data={"code": code, "message": "Adjunto la minuta del día."})
    assert r.status_code == 200, r.text
    detail = client.get(f"/api/pqrs/{pid}", headers=admin).json()
    assert detail["status"] == "in_progress" and detail["sla"]["policy"]["pauses"] == 1

    body = "Lamentamos lo ocurrido. Se tomaron medidas disciplinarias y se reforzó el puesto con un supervisor."
    r = client.post(f"/api/pqrs/{pid}/responses", headers=admin, json={"body": body, "action": "submit"})
    assert r.json()["status"] == "pending_approval"
    resp_id = r.json()["responses"][-1]["id"]
    r = client.post(f"/api/pqrs/{pid}/responses/{resp_id}/approve", headers=admin, json={})
    assert r.status_code == 200, r.text
    final = r.json()
    assert final["status"] == "responded" and final["sla"]["state"] == "met"
    pdf = next(a for a in final["attachments"] if a["source"] == "response")
    file = client.get(f"/api/pqrs/{pid}/attachments/{pdf['id']}", headers=admin)
    assert file.content.startswith(b"%PDF")

    status = client.get(f"/api/public/tenants/servigpoder/pqrs/{radicado}?code={code}").json()
    assert status["status"] == "responded" and status["response_available"] is True
    assert all(e["kind"] != "comment" for e in status["events"])  # notas internas no salen al portal
    assert client.get(f"/api/public/tenants/servigpoder/pqrs/{radicado}?code=MALO123").status_code == 404

    # Notificaciones in-app y correos encolados (acuse + respuesta).
    jobs = client.portal.call(client.fake_redis.lrange, "jobs:default", 0, -1)
    subjects = [json.loads(j)["payload"]["subject"] for j in jobs]
    assert any(s.startswith("Radicado") for s in subjects) and any(s.startswith("Respuesta al radicado") for s in subjects)


def test_public_validation_and_anonymous(client, admin):
    rt, cat, sub = catalog_ids(client, admin)
    r = public_create(client, {"segment": "external", "request_type_id": rt, "subject": "Hola",
                               "description": "Sin datos del solicitante", "consent": True})
    assert r.status_code == 422
    r = public_create(client, {"segment": "external", "request_type_id": rt, "subject": "Denuncia",
                               "description": "Reporte anónimo de una conducta.", "consent": True,
                               "is_anonymous": True})
    assert r.status_code == 201, r.text
    r = public_create(client, {"segment": "external", "request_type_id": rt, "subject": "Hola",
                               "description": "Sin autorización de datos", "consent": False,
                               "requester": {"name": "X", "email": "x@x.co"}})
    assert r.status_code == 422


def test_internal_employee_request_links_employee(client, admin):
    r = client.post("/api/employees", headers=admin, json={"document": "1.144.000.111", "full_name": "Luis Gómez",
                                                           "position": "Vigilante"})
    assert r.status_code == 201, r.text
    rt, cat, sub = catalog_ids(client, admin, "internal")
    r = public_create(client, {"segment": "internal", "request_type_id": rt, "category_id": cat,
                               "subject": "Pago incompleto", "description": "Faltan las horas extras de octubre.",
                               "consent": True, "requester": {"name": "Luis", "email": "luis@x.co",
                                                              "document": "1144000111"}})
    assert r.status_code == 201, r.text
    item = client.get("/api/pqrs?segment=internal", headers=admin).json()["items"][0]
    detail = client.get(f"/api/pqrs/{item['id']}", headers=admin).json()
    assert detail["employee"]["name"] == "Luis Gómez"
    # Una categoría externa no sirve para un caso interno.
    _, ext_cat, _ = catalog_ids(client, admin, "external")
    r = public_create(client, {"segment": "internal", "request_type_id": rt, "category_id": ext_cat,
                               "subject": "x", "description": "categoría equivocada", "consent": True,
                               "requester": {"name": "Luis", "email": "luis@x.co", "document": "1144000111"}})
    assert r.status_code == 422


def test_reports_and_export(client, admin):
    rt, cat, sub = catalog_ids(client, admin)
    public_create(client, {"segment": "external", "request_type_id": rt, "category_id": cat, "subject": "Caso",
                           "description": "Descripción del caso", "consent": True,
                           "requester": {"name": "A", "email": "a@a.co"}})
    rep = client.get("/api/reports/pqrs", headers=admin).json()
    assert rep["total"] == 1 and rep["open"] == 1
    assert client.get("/api/reports/dashboard", headers=admin).status_code == 200
    x = client.get("/api/reports/pqrs/export.xlsx", headers=admin)
    assert x.status_code == 200 and x.content[:2] == b"PK"
    pdf = client.get("/api/reports/pqrs/summary.pdf", headers=admin)
    assert pdf.content.startswith(b"%PDF")

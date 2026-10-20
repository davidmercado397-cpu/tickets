"""Queja de cliente externo → análisis de causa raíz obligatorio liderado por Calidad."""

from __future__ import annotations

from tests.conftest import catalog_ids, login, make_client_site, public_create


def _area(client, h, code):
    return next(a for a in client.get("/api/areas", headers=h).json() if a["code"] == code)


def _role(client, h, code):
    return next(r for r in client.get("/api/roles", headers=h).json() if r["code"] == code)


def _queja(client, admin) -> str:
    rt, cat, sub = catalog_ids(client, admin, type_code="queja")
    c, site = make_client_site(client, admin)
    r = public_create(client, {
        "segment": "external", "request_type_id": rt, "category_id": cat, "subcategory_id": sub,
        "subject": "Vigilante grosero", "description": "El vigilante trató mal a los residentes.",
        "client_id": c["id"], "site_id": site["id"], "consent": True,
        "requester": {"name": "Ana", "email": "ana@x.co"},
    })
    assert r.status_code == 201, r.text
    return client.get(f"/api/pqrs?q={r.json()['radicado']}", headers=admin).json()["items"][0]["id"]


def test_external_complaint_goes_to_quality_and_blocks_response_until_rca_closed(client, admin):
    pid = _queja(client, admin)
    d = client.get(f"/api/pqrs/{pid}", headers=admin).json()
    assert d["requires_rca"] is True and d["rca_status"] == "setup"
    assert d["area"]["name"] == "Calidad"  # llega primero a Calidad, no al área de la categoría
    assert client.get("/api/pqrs?rca_pending=true", headers=admin).json()["total"] == 1

    body = "Respuesta prematura con texto suficiente para la carta."
    r = client.post(f"/api/pqrs/{pid}/responses", headers=admin, json={"body": body, "action": "submit"})
    assert r.status_code == 422 and "causa raíz" in r.json()["detail"]

    # Un gestor de Operaciones aporta por su área.
    ops, gh = _area(client, admin, "operaciones"), _area(client, admin, "gestion_humana")
    r = client.post("/api/users", headers=admin, json={
        "email": "ops@demo.nextbyte.com.co", "full_name": "Jefe Operaciones", "password": "operaciones-1",
        "role_ids": [_role(client, admin, "gestor")["id"]], "area_ids": [ops["id"]],
    })
    assert r.status_code == 201, r.text
    gestor = login(client, "ops@demo.nextbyte.com.co", "operaciones-1")
    assert client.put(f"/api/pqrs/{pid}/rca/setup", headers=gestor,
                      json={"problem_statement": "x" * 12, "area_ids": [ops["id"]]}).status_code == 403

    r = client.put(f"/api/pqrs/{pid}/rca/setup", headers=admin, json={
        "method": "five_whys", "problem_statement": "Trato inadecuado del vigilante nocturno al cliente.",
        "area_ids": [ops["id"], gh["id"]],
    })
    assert r.status_code == 200 and r.json()["status"] == "analysis"

    # El gestor ve el caso (participa su área) y solo puede aportar por su área.
    assert client.get(f"/api/pqrs/{pid}", headers=gestor).status_code == 200
    rca = client.get(f"/api/pqrs/{pid}/rca", headers=gestor).json()
    assert {p["area"]["name"]: p["can_contribute"] for p in rca["participants"]} == {
        "Operaciones": True, "Gestión Humana": False}
    assert client.put(f"/api/pqrs/{pid}/rca/contributions/{gh['id']}", headers=gestor,
                      json={"analysis": "No me corresponde aportar", "whys": ["x"]}).status_code == 403
    r = client.put(f"/api/pqrs/{pid}/rca/contributions/{ops['id']}", headers=gestor, json={
        "analysis": "El vigilante no recibió inducción en servicio al cliente.",
        "whys": ["Respondió mal", "Estaba cansado", "Doble turno", "Falta de personal de relevo"],
    })
    assert r.status_code == 200, r.text

    # No se consolida hasta que todas las áreas aporten.
    consolidate = {"root_cause": "Doble turno por falta de relevo y sin inducción.", "cause_category": "people"}
    r = client.post(f"/api/pqrs/{pid}/rca/consolidate", headers=admin, json=consolidate)
    assert r.status_code == 422 and "Gestión Humana" in r.json()["detail"]
    client.put(f"/api/pqrs/{pid}/rca/contributions/{gh['id']}", headers=admin, json={
        "analysis": "No se programó la inducción de servicio al cliente.", "whys": ["Sin programa de inducción"]})
    r = client.post(f"/api/pqrs/{pid}/rca/consolidate", headers=admin, json=consolidate)
    assert r.json()["status"] == "validation"

    r = client.post(f"/api/pqrs/{pid}/rca/validate", headers=admin,
                    json={"plan_required": True, "note": "Es recurrente en el puesto."})
    assert r.json()["status"] == "plan"
    assert client.post(f"/api/pqrs/{pid}/rca/close", headers=admin, json={}).status_code == 422  # sin acciones
    me = client.get("/api/auth/me", headers=admin).json()
    r = client.post(f"/api/pqrs/{pid}/rca/actions", headers=admin, json={
        "title": "Inducción en servicio al cliente al personal del puesto", "assignee_id": me["id"],
        "due_date": "2026-12-15", "priority": "high"})
    assert r.status_code == 200 and len(r.json()["actions"]) == 1
    tasks = client.get("/api/tasks?source_type=action_plan", headers=admin).json()
    assert tasks["total"] == 1 and tasks["items"][0]["source_id"] == pid

    r = client.post(f"/api/pqrs/{pid}/rca/close", headers=admin, json={"summary": "Plan aprobado por Calidad."})
    assert r.json()["status"] == "closed"
    pdf = client.get(f"/api/pqrs/{pid}/rca/report.pdf", headers=admin)
    assert pdf.content.startswith(b"%PDF")

    # Con el RCA cerrado ya se puede responder.
    r = client.post(f"/api/pqrs/{pid}/responses", headers=admin, json={"body": body, "action": "send"})
    assert r.status_code == 200 and r.json()["status"] == "responded", r.text
    kinds = {e["kind"] for e in r.json()["events"]}
    assert {"rca_required", "rca_setup", "rca_contribution", "rca_root_cause", "rca_validated", "rca_closed"} <= kinds


def test_rca_without_action_plan_closes_on_validation(client, admin):
    pid = _queja(client, admin)
    ops = _area(client, admin, "operaciones")
    client.put(f"/api/pqrs/{pid}/rca/setup", headers=admin, json={
        "method": "free", "problem_statement": "Demora en atender el llamado del cliente.", "area_ids": [ops["id"]]})
    client.put(f"/api/pqrs/{pid}/rca/contributions/{ops['id']}", headers=admin,
               json={"analysis": "Fue un hecho aislado por falla del radio."})
    client.post(f"/api/pqrs/{pid}/rca/consolidate", headers=admin,
                json={"root_cause": "Falla puntual del equipo de radio.", "cause_category": "machine"})
    r = client.post(f"/api/pqrs/{pid}/rca/validate", headers=admin,
                    json={"plan_required": False, "note": "Hecho aislado, equipo ya reemplazado."})
    assert r.json()["status"] == "closed" and r.json()["plan_required"] is False


def test_rca_only_for_configured_types_and_reclassification(client, admin):
    # Una queja interna (empleado) no exige RCA; un reclamo externo tampoco.
    rt_int, cat_int, _ = catalog_ids(client, admin, "internal", type_code="queja")
    r = public_create(client, {"segment": "internal", "request_type_id": rt_int, "category_id": cat_int,
                               "subject": "Queja interna", "description": "Descripción de la queja interna.",
                               "consent": True, "requester": {"name": "B", "email": "b@x.co", "document": "123"}})
    pid = client.get(f"/api/pqrs?q={r.json()['radicado']}", headers=admin).json()["items"][0]["id"]
    assert client.get(f"/api/pqrs/{pid}", headers=admin).json()["requires_rca"] is False

    rt, _, _ = catalog_ids(client, admin)  # reclamo externo
    r = public_create(client, {"segment": "external", "request_type_id": rt, "subject": "Reclamo",
                               "description": "Reclamo por el servicio prestado.", "consent": True,
                               "requester": {"name": "C", "email": "c@x.co"}})
    pid = client.get(f"/api/pqrs?q={r.json()['radicado']}", headers=admin).json()["items"][0]["id"]
    assert client.get(f"/api/pqrs/{pid}", headers=admin).json()["requires_rca"] is False
    # Calidad lo reclasifica como queja → se activa el RCA y pasa a Calidad.
    types = client.get("/api/catalog/request-types", headers=admin).json()
    queja = next(t for t in types if t["code"] == "queja")
    d = client.post(f"/api/pqrs/{pid}/classify", headers=admin, json={"request_type_id": queja["id"]}).json()
    assert d["requires_rca"] is True and d["area"]["name"] == "Calidad"

    # El tipo es configurable: el reclamo también puede exigir RCA para clientes externos.
    reclamo = next(t for t in types if t["code"] == "reclamo")
    r = client.patch(f"/api/catalog/request-types/{reclamo['id']}", headers=admin, json={"rca_segments": ["external"]})
    assert r.json()["rca_segments"] == ["external"]

from __future__ import annotations

from tests.conftest import catalog_ids, login, make_client_site, public_create


def _role(client, admin, code):
    return next(r for r in client.get("/api/roles", headers=admin).json() if r["code"] == code)


def test_dynamic_role_and_area_scope(client, admin):
    areas = {a["code"]: a["id"] for a in client.get("/api/areas", headers=admin).json()}
    r = client.post("/api/roles", headers=admin, json={"name": "Coordinador SST",
                                                       "permissions": ["pqrs.view_area", "pqrs.manage"]})
    assert r.status_code == 201, r.text
    assert client.post("/api/roles", headers=admin, json={"name": "Malo", "permissions": ["no.existe"]}).status_code == 422
    r = client.post("/api/users", headers=admin, json={
        "email": "sst@demo.nextbyte.com.co", "full_name": "Coord SST", "password": "coord-secreto-1",
        "role_ids": [r.json()["id"]], "area_ids": [areas["sst"]],
    })
    assert r.status_code == 201, r.text
    h = login(client, "sst@demo.nextbyte.com.co", "coord-secreto-1")

    rt, cat, sub = catalog_ids(client, admin)  # categoría externa → área operaciones
    public_create(client, {"segment": "external", "request_type_id": rt, "category_id": cat, "subject": "Operativo",
                           "description": "Caso del área de operaciones", "consent": True,
                           "requester": {"name": "A", "email": "a@a.co"}})
    assert client.get("/api/pqrs", headers=h).json()["total"] == 0  # no es de su área
    assert client.get("/api/clients", headers=h).status_code == 403
    assert client.post("/api/areas", headers=h, json={"name": "X"}).status_code == 403
    # Editar el rol del sistema "gestor" y verificar que el admin no se puede recortar.
    admin_role = _role(client, admin, "admin")
    assert client.patch(f"/api/roles/{admin_role['id']}", headers=admin, json={"permissions": []}).status_code == 422


def test_visit_with_findings_creates_tasks_and_compliance(client, admin):
    c, site = make_client_site(client, admin)
    jefe_role = _role(client, admin, "jefe_operacion")
    r = client.post("/api/users", headers=admin, json={"email": "jefe@demo.nextbyte.com.co", "full_name": "Jefe Operación",
                                                       "password": "jefe-secreto-12", "role_ids": [jefe_role["id"]]})
    assert r.status_code == 201
    jefe_id = r.json()["id"]
    jefe = login(client, "jefe@demo.nextbyte.com.co", "jefe-secreto-12")

    r = client.put("/api/visits/quotas", headers=admin, json={"site_id": site["id"], "visits_per_month": 2})
    assert r.status_code == 200, r.text
    form = client.get("/api/visits/forms", headers=jefe).json()[0]

    r = client.post("/api/visits", headers=jefe, json={"form_id": form["id"], "site_id": site["id"]})
    assert r.status_code == 201, r.text
    vid = r.json()["id"]
    up = client.post(f"/api/visits/{vid}/files", headers=jefe, data={"field_id": "foto_puesto"},
                     files={"file": ("p.jpg", b"\xff\xd8\xff", "image/jpeg")})
    assert up.status_code == 201, up.text
    answers = {"uniforme": "no", "credencial": "yes", "minuta": "yes", "consignas": "yes",
               "comunicaciones": "yes", "dotacion": "Bueno", "satisfaccion": 2}
    # Falta lo obligatorio → 422
    assert client.post(f"/api/visits/{vid}/complete", headers=jefe, json={"answers": {"uniforme": "no"}}).status_code == 422
    preview = client.post(f"/api/visits/{vid}/evaluate", headers=jefe, json={"answers": answers}).json()
    assert {f["field_id"] for f in preview["findings"]} == {"uniforme", "satisfaccion"}
    r = client.post(f"/api/visits/{vid}/complete", headers=jefe, json={
        "answers": answers,
        "tasks": [{"field_id": f["field_id"], "title": f["suggested_task"], "assignee_id": jefe_id,
                   "due_date": "2026-12-01"} for f in preview["findings"]],
    })
    assert r.status_code == 200, r.text
    visit = r.json()
    assert visit["status"] == "completed" and len(visit["tasks"]) == 2 and visit["score"] is not None

    tasks = client.get("/api/tasks?mine=true", headers=jefe).json()
    assert tasks["total"] == 2 and tasks["items"][0]["source_type"] == "visit"
    tid = tasks["items"][0]["id"]
    r = client.post(f"/api/tasks/{tid}/updates", headers=jefe, data={"note": "Uniforme entregado", "status": "done"},
                    files={"files": ("acta.pdf", b"%PDF-1.4", "application/pdf")})
    assert r.status_code == 200 and r.json()["status"] == "done"

    month = visit["completed_at"][:7]
    comp = client.get(f"/api/visits/compliance?month={month}", headers=admin).json()
    assert comp["required"] == 2 and comp["rows"][0]["done"] == 1 and comp["percent"] == 50.0
    assert client.get(f"/api/reports/visits?month={month}", headers=admin).json()["total_findings"] == 2


def test_dynamic_form_builder_validation(client, admin):
    bad = {"name": "Formulario", "fields": [{"id": "a", "type": "select", "label": "Elige", "options": ["uno"]}]}
    assert client.post("/api/visits/forms", headers=admin, json=bad).status_code == 422
    dup = {"name": "Formulario", "fields": [{"id": "a", "type": "text", "label": "A"},
                                            {"id": "a", "type": "text", "label": "B"}]}
    assert client.post("/api/visits/forms", headers=admin, json=dup).status_code == 422
    ok = {"name": "Inspección nocturna", "fields": [
        {"id": "luces", "type": "yesno", "label": "¿Iluminación perimetral funcionando?", "required": True,
         "finding": {"op": "equals", "value": "no", "task_title": "Reportar falla de iluminación"}},
    ]}
    r = client.post("/api/visits/forms", headers=admin, json=ok)
    assert r.status_code == 201 and r.json()["version"] == 1
    ok["fields"].append({"id": "notas", "type": "textarea", "label": "Notas"})
    r = client.put(f"/api/visits/forms/{r.json()['id']}", headers=admin, json=ok)
    assert r.json()["version"] == 2

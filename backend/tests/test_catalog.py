"""CRUD de catálogos (áreas/categorías): code autogenerado, validación, unicidad, inmutabilidad."""

from __future__ import annotations

from tests.conftest import AUTH, create_area, create_category


def test_create_area_autogenerates_code_slug(client):
    area = create_area(client, "Recursos Humanos")
    assert area["code"] == "recursos_humanos"
    assert area["name"] == "Recursos Humanos"
    assert area["active"] is True
    assert set(area.keys()) == {"id", "code", "name", "active"}


def test_create_area_explicit_code(client):
    area = create_area(client, "Recursos Humanos", code="rrhh")
    assert area["code"] == "rrhh"


def test_invalid_code_returns_422(client):
    r = client.post("/api/areas", headers=AUTH, json={"name": "Área", "code": "A B"})
    assert r.status_code == 422


def test_duplicate_code_returns_409(client):
    create_area(client, "Recursos Humanos", code="rrhh")
    r = client.post("/api/areas", headers=AUTH, json={"name": "Otra", "code": "rrhh"})
    assert r.status_code == 409


def test_rename_does_not_change_code(client):
    area = create_area(client, "RRHH", code="rrhh")
    r = client.patch(
        f"/api/areas/{area['id']}", headers=AUTH, json={"name": "Recursos Humanos"}
    )
    assert r.status_code == 200
    assert r.json()["code"] == "rrhh"
    assert r.json()["name"] == "Recursos Humanos"


def test_patch_code_returns_422(client):
    area = create_area(client, "RRHH", code="rrhh")
    r = client.patch(f"/api/areas/{area['id']}", headers=AUTH, json={"code": "otro"})
    assert r.status_code == 422


def test_soft_disable_deactivates_and_filters(client):
    area = create_area(client, "Contabilidad", code="conta")
    r = client.delete(f"/api/areas/{area['id']}", headers=AUTH)
    assert r.status_code == 200
    assert r.json()["active"] is False
    activos = client.get("/api/areas", headers=AUTH, params={"only_active": True}).json()
    assert all(a["code"] != "conta" for a in activos)


def test_create_category_under_area(client):
    create_area(client, "Recursos Humanos", code="rrhh")
    cat = create_category(client, "Incapacidad", area_code="rrhh")
    assert cat["code"] == "incapacidad"
    assert cat["area"] == "rrhh"
    assert cat["active"] is True


def test_category_with_unknown_area_returns_422(client):
    r = client.post(
        "/api/categories", headers=AUTH, json={"name": "X", "area": "no_existe"}
    )
    assert r.status_code == 422


def test_category_duplicate_code_returns_409(client):
    create_area(client, "Recursos Humanos", code="rrhh")
    create_area(client, "Contabilidad", code="conta")
    create_category(client, "Nómina RRHH", area_code="rrhh", code="nomina_rrhh")
    r = client.post(
        "/api/categories",
        headers=AUTH,
        json={"name": "Nómina Conta", "area": "conta", "code": "nomina_rrhh"},
    )
    assert r.status_code == 409

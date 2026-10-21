"""El superadministrador edita los datos de una empresa y gestiona sus usuarios."""

from __future__ import annotations

from tests.conftest import ADMIN, login


def _demo(client, superadmin) -> dict:
    return next(t for t in client.get("/api/platform/tenants", headers=superadmin).json() if t["slug"] == "demo")


def test_superadmin_edits_tenant_data_but_not_slug(client, superadmin):
    t = _demo(client, superadmin)
    r = client.patch(f"/api/platform/tenants/{t['id']}", headers=superadmin, json={
        "name": "Empresa 1", "legal_name": "Empresa Uno S.A.S.", "nit": "987123654", "radicado_prefix": "e-1",
        "city": "Cali", "email": "", "slug": "otro-slug",
    })
    assert r.status_code == 200, r.text
    d = r.json()
    assert (d["name"], d["legal_name"], d["nit"], d["radicado_prefix"]) == ("Empresa 1", "Empresa Uno S.A.S.", "987123654", "E1")
    assert d["slug"] == "demo"  # el identificador del portal no cambia


def test_superadmin_manages_tenant_users(client, superadmin, admin):
    t = _demo(client, superadmin)
    users = client.get(f"/api/platform/tenants/{t['id']}/users", headers=superadmin).json()
    adm = next(u for u in users if u["email"] == ADMIN[0])
    assert adm["is_admin"] is True and users[0]["is_admin"] is True

    # Cambiar correo y contraseña del administrador.
    r = client.patch(f"/api/platform/tenants/{t['id']}/users/{adm['id']}", headers=superadmin,
                     json={"email": "nuevo.admin@empresa1.co", "password": "clave-nueva-123", "full_name": "Nuevo Admin"})
    assert r.status_code == 200, r.text
    assert client.post("/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}).status_code == 401
    h = login(client, "nuevo.admin@empresa1.co", "clave-nueva-123")
    assert client.get("/api/auth/me", headers=h).json()["full_name"] == "Nuevo Admin"

    # Agregar otro administrador; correo repetido → 409.
    r = client.post(f"/api/platform/tenants/{t['id']}/users", headers=superadmin,
                    json={"email": "segundo@empresa1.co", "full_name": "Segundo Admin", "password": "segundo-123"})
    assert r.status_code == 201 and r.json()["is_admin"] is True
    r = client.post(f"/api/platform/tenants/{t['id']}/users", headers=superadmin,
                    json={"email": "segundo@empresa1.co", "full_name": "Otro", "password": "otro-12345"})
    assert r.status_code == 409
    r = client.patch(f"/api/platform/tenants/{t['id']}/users/{adm['id']}", headers=superadmin,
                     json={"email": "segundo@empresa1.co"})
    assert r.status_code == 409

    # Solo el superadministrador accede a estas rutas.
    assert client.get(f"/api/platform/tenants/{t['id']}/users", headers=h).status_code == 403

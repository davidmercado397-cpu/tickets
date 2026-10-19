"""Registro de módulos activos del monolito modular.

El ORDEN importa para la siembra de una empresa nueva (p. ej. identity crea las áreas que catalog usa).
Para agregar un módulo (p. ej. minutas): crea `app/modules/minutas/` con su `module.py` y añádelo aquí."""

from __future__ import annotations

from importlib import import_module

from app.core.module import Module, register_tenant_seeder

MODULE_NAMES = [
    "tenancy",
    "identity",
    "catalog",
    "sla",
    "clients",
    "employees",
    "pqrs",
    "documents",
    "notifications",
    "channels",
    "tasks",
    "visits",
    "reports",
]


def load_modules() -> list[Module]:
    modules = [import_module(f"app.modules.{name}.module").module for name in MODULE_NAMES]
    for m in modules:
        if m.seed_tenant:
            register_tenant_seeder(m.seed_tenant)
    return modules

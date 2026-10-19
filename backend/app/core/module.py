"""Contrato de un módulo enchufable del monolito modular.

`app/modules/__init__.py` lista los módulos activos; `main.py` monta sus routers y el worker sus
tareas periódicas. Un módulo nuevo (p. ej. minutas) = una carpeta + una entrada en esa lista."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

TenantSeeder = Callable[[AsyncSession, uuid.UUID], Awaitable[None]]
PeriodicTask = tuple[str, Callable[[], int], Callable[[], Awaitable[None]]]  # (nombre, cada_seg, fn)


@dataclass
class Module:
    name: str
    routers: list[APIRouter] = field(default_factory=list)
    # Siembra datos por defecto al crear una empresa (misma transacción). Orden = orden de MODULES.
    seed_tenant: TenantSeeder | None = None
    periodic: list[PeriodicTask] = field(default_factory=list)


_tenant_seeders: list[TenantSeeder] = []


def register_tenant_seeder(fn: TenantSeeder) -> None:
    if fn not in _tenant_seeders:
        _tenant_seeders.append(fn)


async def run_tenant_seeders(session: AsyncSession, tenant_id: uuid.UUID) -> None:
    for fn in _tenant_seeders:
        await fn(session, tenant_id)

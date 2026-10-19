from app.core.config import get_settings
from app.core.db import session_factory
from app.core.module import Module
from app.core.permissions import register
from app.modules.pqrs.router import integration_router, public_router, router
from app.modules.pqrs.service import sla_scan

register(
    "PQRS",
    ("pqrs.view_all", "Ver todas las PQRS"),
    ("pqrs.view_area", "Ver las PQRS de mis áreas"),
    ("pqrs.create", "Radicar PQRS manuales (ventanilla)"),
    ("pqrs.classify", "Clasificar PQRS (tipo, categoría, área, prioridad) y anular"),
    ("pqrs.assign", "Asignar responsables"),
    ("pqrs.manage", "Gestionar casos (estados, notas, adjuntos)"),
    ("pqrs.respond", "Proyectar respuestas"),
    ("pqrs.approve", "Aprobar y enviar respuestas"),
)


async def _sla_scan() -> None:
    async with session_factory()() as session:
        await sla_scan(session)


module = Module(
    name="pqrs",
    routers=[router, public_router, integration_router],
    periodic=[("pqrs.sla_scan", lambda: get_settings().WORKER_SLA_SCAN_SECONDS, _sla_scan)],
)

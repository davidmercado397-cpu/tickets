"""Políticas de SLA por prioridad (config-as-data). Lectura para cualquier autenticado; gestión = admin.

Los tickets calculan sus vencimientos con estas políticas al crearse. Editar una política afecta a los
tickets NUEVOS (los ya creados conservan su vencimiento)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.schemas import SlaPolicyOut, SlaPolicyUpsertIn, to_sla_policy_out
from app.dependencies import SlaServiceDep, require_caller, require_privileged
from app.domain.models import Priority

router = APIRouter(prefix="/sla-policies", tags=["sla"])


@router.get("", summary="Listar políticas de SLA", dependencies=[Depends(require_caller)])
async def list_policies(sla: SlaServiceDep) -> list[SlaPolicyOut]:
    return [to_sla_policy_out(p) for p in await sla.list_policies()]


@router.put(
    "/{priority}",
    summary="Crear/actualizar la política de una prioridad (admin)",
    dependencies=[Depends(require_privileged)],
)
async def upsert_policy(
    priority: Priority, body: SlaPolicyUpsertIn, sla: SlaServiceDep
) -> SlaPolicyOut:
    policy = await sla.upsert_policy(
        priority, body.response_minutes, body.resolution_minutes
    )
    return to_sla_policy_out(policy)

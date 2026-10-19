"""Gestión de usuarios por el admin IN-APP (JWT con rol admin).

El primer admin se **siembra** en el arranque (`SEED_ADMIN_*`); a partir de ahí, un admin dentro de la
app crea agentes/admins, cambia rol/áreas/estado y resetea contraseñas. Un agente → 403 (require_admin)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.api.schemas import UserCreateIn, UserOut, UserUpdateIn, to_user_out
from app.dependencies import UserServiceDep, require_admin

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


@router.post("", status_code=status.HTTP_201_CREATED, summary="Crear usuario (admin)")
async def create_user(body: UserCreateIn, service: UserServiceDep) -> UserOut:
    user = await service.create_user(
        email=body.email,
        password=body.password,
        role=body.role,
        display_name=body.display_name,
        phone=body.phone,
        area_codes=body.area_codes,
    )
    return to_user_out(user)


@router.get("", summary="Listar usuarios")
async def list_users(service: UserServiceDep) -> list[UserOut]:
    return [to_user_out(u) for u in await service.list_users()]


@router.get("/{user_id}", summary="Obtener usuario")
async def get_user(user_id: uuid.UUID, service: UserServiceDep) -> UserOut:
    return to_user_out(await service.get_user(user_id))


@router.patch("/{user_id}", summary="Actualizar rol/áreas/estado/nombre/contraseña")
async def update_user(
    user_id: uuid.UUID, body: UserUpdateIn, service: UserServiceDep
) -> UserOut:
    user = await service.update_user(
        user_id,
        display_name=body.display_name,
        phone=body.phone,
        role=body.role,
        active=body.active,
        area_codes=body.area_codes,
        password=body.password,
    )
    return to_user_out(user)

"""Routers de catálogo: /areas y /categories.

- **GET** (catálogo): lo consume el bot (service-token) y los usuarios (JWT) → `require_caller`.
- **POST/PATCH/DELETE** (gestión): admin o service-token → `require_privileged`. Un agente → 403.

El `code` es inmutable tras crear (PATCH con `code` → 422)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status

from app.api.schemas import (
    AreaCreateIn,
    AreaOut,
    AreaUpdateIn,
    CategoryCreateIn,
    CategoryOut,
    CategoryUpdateIn,
    to_area_out,
    to_category_out,
)
from app.dependencies import CatalogServiceDep, require_caller, require_privileged

areas_router = APIRouter(prefix="/areas", tags=["areas"])
categories_router = APIRouter(prefix="/categories", tags=["categories"])


# --- Áreas ---

@areas_router.get("", summary="Listar/catálogo de áreas", dependencies=[Depends(require_caller)])
async def list_areas(
    service: CatalogServiceDep, only_active: bool = Query(default=False)
) -> list[AreaOut]:
    return [to_area_out(a) for a in await service.list_areas(only_active=only_active)]


@areas_router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Crear área",
    dependencies=[Depends(require_privileged)],
)
async def create_area(body: AreaCreateIn, service: CatalogServiceDep) -> AreaOut:
    return to_area_out(await service.create_area(name=body.name, code=body.code))


@areas_router.get(
    "/{area_id}", summary="Obtener área", dependencies=[Depends(require_caller)]
)
async def get_area(area_id: uuid.UUID, service: CatalogServiceDep) -> AreaOut:
    return to_area_out(await service.get_area(area_id))


@areas_router.patch(
    "/{area_id}",
    summary="Actualizar nombre/estado del área (code inmutable)",
    dependencies=[Depends(require_privileged)],
)
async def update_area(
    area_id: uuid.UUID, body: AreaUpdateIn, service: CatalogServiceDep
) -> AreaOut:
    return to_area_out(
        await service.update_area(
            area_id, name=body.name, active=body.active, code=body.code
        )
    )


@areas_router.delete(
    "/{area_id}",
    summary="Desactivar área (soft-disable)",
    dependencies=[Depends(require_privileged)],
)
async def delete_area(area_id: uuid.UUID, service: CatalogServiceDep) -> AreaOut:
    return to_area_out(await service.delete_area(area_id))


# --- Categorías ---

@categories_router.get(
    "", summary="Listar/catálogo de categorías", dependencies=[Depends(require_caller)]
)
async def list_categories(
    service: CatalogServiceDep, only_active: bool = Query(default=False)
) -> list[CategoryOut]:
    return [to_category_out(c) for c in await service.list_categories(only_active=only_active)]


@categories_router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Crear categoría",
    dependencies=[Depends(require_privileged)],
)
async def create_category(body: CategoryCreateIn, service: CatalogServiceDep) -> CategoryOut:
    return to_category_out(
        await service.create_category(name=body.name, area_code=body.area, code=body.code)
    )


@categories_router.get(
    "/{category_id}", summary="Obtener categoría", dependencies=[Depends(require_caller)]
)
async def get_category(category_id: uuid.UUID, service: CatalogServiceDep) -> CategoryOut:
    return to_category_out(await service.get_category(category_id))


@categories_router.patch(
    "/{category_id}",
    summary="Actualizar nombre/estado de la categoría (code inmutable)",
    dependencies=[Depends(require_privileged)],
)
async def update_category(
    category_id: uuid.UUID, body: CategoryUpdateIn, service: CatalogServiceDep
) -> CategoryOut:
    return to_category_out(
        await service.update_category(
            category_id, name=body.name, active=body.active, code=body.code
        )
    )


@categories_router.delete(
    "/{category_id}",
    summary="Desactivar categoría (soft-disable)",
    dependencies=[Depends(require_privileged)],
)
async def delete_category(category_id: uuid.UUID, service: CatalogServiceDep) -> CategoryOut:
    return to_category_out(await service.delete_category(category_id))

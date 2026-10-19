"""Lógica de catálogos (áreas y categorías): reglas del `code`, unicidad, inmutabilidad, soft-disable.

Depende de los puertos `AreaRepository`/`CategoryRepository` (no de SQLAlchemy). Lanza errores de
dominio (`app.domain.errors`) que la API traduce a HTTP."""

from __future__ import annotations

import uuid

from app.domain.errors import ConflictError, NotFoundError, ValidationError
from app.domain.models import Area, Category
from app.domain.ports import AreaRepository, CategoryRepository
from app.services.slugify import is_valid_code, slugify

_CODE_HELP = "El code debe cumplir ^[a-z0-9_-]{2,40}$ (minúsculas, dígitos, '_' o '-')."


def _resolve_code(name: str, code: str | None) -> str:
    """Code final: el explícito si vino, o slugify(name). Valida formato."""
    candidate = (code or slugify(name)).strip()
    if not is_valid_code(candidate):
        raise ValidationError(
            f"code inválido: '{candidate}'. {_CODE_HELP} "
            "(Si el nombre no produce un code válido, indícalo explícitamente.)"
        )
    return candidate


class CatalogService:
    def __init__(self, areas: AreaRepository, categories: CategoryRepository) -> None:
        self._areas = areas
        self._categories = categories

    # --- Áreas ---

    async def list_areas(self, only_active: bool = False) -> list[Area]:
        return await self._areas.list(only_active=only_active)

    async def get_area(self, area_id: uuid.UUID) -> Area:
        area = await self._areas.get(area_id)
        if area is None:
            raise NotFoundError(f"Área '{area_id}' no existe.")
        return area

    async def create_area(self, name: str, code: str | None = None) -> Area:
        final_code = _resolve_code(name, code)
        if await self._areas.get_by_code(final_code) is not None:
            raise ConflictError(f"Ya existe un área con code '{final_code}'.")
        return await self._areas.create(code=final_code, name=name)

    async def update_area(
        self,
        area_id: uuid.UUID,
        name: str | None = None,
        active: bool | None = None,
        code: str | None = None,
    ) -> Area:
        if code is not None:
            raise ValidationError("El `code` es inmutable: no se puede cambiar tras crear el área.")
        area = await self._areas.update(area_id, name=name, active=active)
        if area is None:
            raise NotFoundError(f"Área '{area_id}' no existe.")
        return area

    async def delete_area(self, area_id: uuid.UUID) -> Area:
        """Soft-disable: desactiva el área (no se borra físicamente para no romper referencias)."""
        area = await self._areas.update(area_id, active=False)
        if area is None:
            raise NotFoundError(f"Área '{area_id}' no existe.")
        return area

    # --- Categorías ---

    async def list_categories(self, only_active: bool = False) -> list[Category]:
        return await self._categories.list(only_active=only_active)

    async def get_category(self, category_id: uuid.UUID) -> Category:
        category = await self._categories.get(category_id)
        if category is None:
            raise NotFoundError(f"Categoría '{category_id}' no existe.")
        return category

    async def create_category(
        self, name: str, area_code: str, code: str | None = None
    ) -> Category:
        area = await self._areas.get_by_code(area_code)
        if area is None:
            raise ValidationError(f"El área '{area_code}' no existe (la categoría debe pertenecer a una).")
        final_code = _resolve_code(name, code)
        if await self._categories.get_by_code(final_code) is not None:
            raise ConflictError(f"Ya existe una categoría con code '{final_code}'.")
        return await self._categories.create(code=final_code, name=name, area_id=area.id)

    async def update_category(
        self,
        category_id: uuid.UUID,
        name: str | None = None,
        active: bool | None = None,
        code: str | None = None,
    ) -> Category:
        if code is not None:
            raise ValidationError(
                "El `code` es inmutable: no se puede cambiar tras crear la categoría."
            )
        category = await self._categories.update(category_id, name=name, active=active)
        if category is None:
            raise NotFoundError(f"Categoría '{category_id}' no existe.")
        return category

    async def delete_category(self, category_id: uuid.UUID) -> Category:
        """Soft-disable: desactiva la categoría."""
        category = await self._categories.update(category_id, active=False)
        if category is None:
            raise NotFoundError(f"Categoría '{category_id}' no existe.")
        return category

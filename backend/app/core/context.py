"""Identidad de quien llama (resuelta en cada request). La consumen todos los servicios."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from app.core.errors import ForbiddenError


@dataclass(frozen=True)
class Ctx:
    """Usuario humano autenticado, o una integración (API key de empresa)."""

    tenant_id: uuid.UUID | None
    user_id: uuid.UUID | None = None
    email: str = ""
    name: str = ""
    is_superadmin: bool = False
    permissions: frozenset[str] = field(default_factory=frozenset)
    area_ids: tuple[uuid.UUID, ...] = ()
    integration: str | None = None  # nombre de la API key si es una integración

    def can(self, perm: str) -> bool:
        return self.is_superadmin or perm in self.permissions

    def require(self, perm: str) -> None:
        if not self.can(perm):
            raise ForbiddenError(f"Permiso requerido: {perm}")

    @property
    def tid(self) -> uuid.UUID:
        """Empresa obligatoria (los endpoints de negocio no aplican al superadmin sin empresa)."""
        if self.tenant_id is None:
            raise ForbiddenError("Esta operación requiere pertenecer a una empresa.")
        return self.tenant_id

    @property
    def actor_label(self) -> str:
        return self.name or self.email or (f"integración:{self.integration}" if self.integration else "sistema")

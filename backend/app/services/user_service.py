"""Lógica de usuarios: alta (hash + membresía de áreas), autenticación, consulta.

Depende de los puertos `UserRepository`/`AreaRepository`. Nunca expone hash/salt. Lanza errores de
dominio que la API traduce a HTTP."""

from __future__ import annotations

import uuid

from app.domain.errors import ConflictError, NotFoundError, ValidationError
from app.domain.models import Role, User
from app.domain.ports import AreaRepository, UserRepository
from app.services.passwords import hash_password, verify_password

_MIN_PASSWORD_LEN = 8


def _normalize_email(email: str) -> str:
    return email.strip().lower()


class UserService:
    def __init__(self, users: UserRepository, areas: AreaRepository) -> None:
        self._users = users
        self._areas = areas

    async def _resolve_area_ids(self, area_codes: list[str]) -> list[uuid.UUID]:
        """Codes → ids, validando que cada área exista."""
        area_ids: list[uuid.UUID] = []
        for code in area_codes:
            area = await self._areas.get_by_code(code)
            if area is None:
                raise ValidationError(f"El área '{code}' no existe.")
            area_ids.append(area.id)
        return area_ids

    async def create_user(
        self,
        *,
        email: str,
        password: str,
        role: Role,
        display_name: str | None = None,
        phone: str | None = None,
        area_codes: list[str] | None = None,
    ) -> User:
        email = _normalize_email(email)
        if "@" not in email or len(email) < 3:
            raise ValidationError(f"Email inválido: '{email}'.")
        if len(password) < _MIN_PASSWORD_LEN:
            raise ValidationError(
                f"La contraseña debe tener al menos {_MIN_PASSWORD_LEN} caracteres."
            )
        area_ids = await self._resolve_area_ids(area_codes or [])

        if await self._users.get_auth_by_email(email) is not None:
            raise ConflictError(f"Ya existe un usuario con email '{email}'.")

        salt, password_hash = hash_password(password)
        return await self._users.create(
            email=email,
            password_hash=password_hash,
            salt=salt,
            display_name=display_name,
            phone=phone,
            role=role,
            area_ids=area_ids,
        )

    async def authenticate(self, email: str, password: str) -> User | None:
        """Devuelve el usuario si las credenciales son válidas y está activo; None si no."""
        found = await self._users.get_auth_by_email(_normalize_email(email))
        if found is None:
            return None
        user, salt, password_hash = found
        if not user.active or not verify_password(password, salt, password_hash):
            return None
        return user

    async def list_users(self) -> list[User]:
        return await self._users.list()

    async def get_user(self, user_id: uuid.UUID) -> User:
        user = await self._users.get(user_id)
        if user is None:
            raise NotFoundError(f"Usuario '{user_id}' no existe.")
        return user

    async def update_user(
        self,
        user_id: uuid.UUID,
        *,
        display_name: str | None = None,
        phone: str | None = None,
        role: Role | None = None,
        active: bool | None = None,
        area_codes: list[str] | None = None,
        password: str | None = None,
    ) -> User:
        """PATCH: solo cambia lo provisto. `area_codes` (si viene) reemplaza la membresía completa."""
        if await self._users.get(user_id) is None:
            raise NotFoundError(f"Usuario '{user_id}' no existe.")

        password_hash = salt = None
        if password is not None:
            if len(password) < _MIN_PASSWORD_LEN:
                raise ValidationError(
                    f"La contraseña debe tener al menos {_MIN_PASSWORD_LEN} caracteres."
                )
            salt, password_hash = hash_password(password)

        if area_codes is not None:
            area_ids = await self._resolve_area_ids(area_codes)
            await self._users.set_areas(user_id, area_ids)

        updated = await self._users.update(
            user_id,
            display_name=display_name,
            phone=phone,
            role=role,
            active=active,
            password_hash=password_hash,
            salt=salt,
        )
        assert updated is not None  # existencia ya verificada arriba
        return updated

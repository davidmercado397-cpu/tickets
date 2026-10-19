"""Dependencias de autenticación: resuelven el `Ctx` de cada request."""

from __future__ import annotations

import uuid
from typing import Annotated, Callable

import jwt
from fastapi import Depends, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.context import Ctx
from app.core.db import get_session
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.modules.identity import service
from app.modules.identity.models import User

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _bearer(authorization: str | None) -> str | None:
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:].strip()
    return None


async def _load_user(session: AsyncSession, token: str) -> User:
    try:
        claims = decode_access_token(token, get_settings().AUTH_JWT_SIGNING_KEY)
        user_id = uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise UnauthorizedError("Sesión inválida o expirada.") from exc
    user = await service.get_active_user(session, user_id)
    if user is None:
        raise UnauthorizedError("Sesión inválida o expirada.")
    return user


async def current_user(
    session: SessionDep,
    authorization: Annotated[str | None, Header()] = None,
    access_token: Annotated[str | None, Query(include_in_schema=False)] = None,
) -> User:
    """Usuario autenticado. `access_token` por query solo existe para SSE/descargas (EventSource
    y <img> no pueden mandar cabeceras)."""
    token = _bearer(authorization) or access_token
    if not token:
        raise UnauthorizedError("Falta el token de sesión.")
    return await _load_user(session, token)


CurrentUserDep = Annotated[User, Depends(current_user)]


async def current_ctx(user: CurrentUserDep) -> Ctx:
    return service.ctx_from_user(user)


CtxDep = Annotated[Ctx, Depends(current_ctx)]


async def tenant_ctx(ctx: CtxDep) -> Ctx:
    """Ctx de un usuario que pertenece a una empresa (los endpoints de negocio)."""
    if ctx.tenant_id is None:
        raise ForbiddenError("Esta operación es de una empresa; el superadmin no tiene empresa.")
    return ctx


TenantCtxDep = Annotated[Ctx, Depends(tenant_ctx)]


def require(*perms: str) -> Callable:
    """Dependencia: exige AL MENOS uno de los permisos indicados."""

    async def dep(ctx: TenantCtxDep) -> Ctx:
        if not any(ctx.can(p) for p in perms):
            raise ForbiddenError(f"Permiso requerido: {' o '.join(perms)}")
        return ctx

    return dep


async def superadmin_ctx(ctx: CtxDep) -> Ctx:
    if not ctx.is_superadmin:
        raise ForbiddenError("Solo el superadministrador de la plataforma.")
    return ctx


SuperadminDep = Annotated[Ctx, Depends(superadmin_ctx)]

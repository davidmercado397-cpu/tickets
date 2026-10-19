from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Response, UploadFile, status

from app.core.config import get_settings
from app.core.context import Ctx
from app.core.errors import NotFoundError, ValidationError
from app.core.permissions import all_permissions
from app.core.security import issue_access_token
from app.core.storage import new_key, storage
from app.modules.identity import service
from app.modules.identity.deps import CtxDep, CurrentUserDep, SessionDep, TenantCtxDep, require
from app.modules.identity.models import User
from app.modules.identity.schemas import (
    AreaCreate,
    AreaOut,
    AreaUpdate,
    LoginIn,
    MeOut,
    MeUpdate,
    PermissionOut,
    RoleCreate,
    RoleOut,
    RoleUpdate,
    TenantBrief,
    TokenOut,
    UserCreate,
    UserLookup,
    UserOut,
    UserUpdate,
)
from app.modules.tenancy.public import get_tenant_brief

auth_router = APIRouter(prefix="/auth", tags=["auth"])
router = APIRouter(tags=["identidad"])

ManageUsers = Annotated[Ctx, Depends(require("users.manage"))]
ManageRoles = Annotated[Ctx, Depends(require("roles.manage"))]
ManageAreas = Annotated[Ctx, Depends(require("areas.manage"))]

_IMAGE_TYPES = {"image/png", "image/jpeg"}


def user_out(user: User) -> UserOut:
    out = UserOut.model_validate(user)
    out.has_signature = bool(user.signature_key)
    return out


async def _me(session, user: User) -> MeOut:
    ctx = service.ctx_from_user(user)
    tenant = await get_tenant_brief(session, user.tenant_id) if user.tenant_id else None
    return MeOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        position=user.position,
        is_superadmin=user.is_superadmin,
        has_signature=bool(user.signature_key),
        tenant=TenantBrief(**tenant) if tenant else None,
        roles=user.roles,
        areas=user.areas,
        permissions=sorted(ctx.permissions),
    )


@auth_router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, session: SessionDep) -> TokenOut:
    settings = get_settings()
    user = await service.authenticate(session, body.email, body.password)
    token = issue_access_token(user.id, settings.AUTH_JWT_SIGNING_KEY, settings.AUTH_ACCESS_TOKEN_TTL_SECONDS)
    return TokenOut(access_token=token, expires_in=settings.AUTH_ACCESS_TOKEN_TTL_SECONDS)


@auth_router.get("/me", response_model=MeOut)
async def me(user: CurrentUserDep, session: SessionDep) -> MeOut:
    return await _me(session, user)


@auth_router.patch("/me", response_model=MeOut)
async def update_me(body: MeUpdate, user: CurrentUserDep, session: SessionDep) -> MeOut:
    user = await service.update_me(session, user, body.model_dump(exclude_unset=True))
    return await _me(session, user)


async def _save_signature(session, user: User, file: UploadFile) -> None:
    if file.content_type not in _IMAGE_TYPES:
        raise ValidationError("La firma debe ser una imagen PNG o JPG.")
    data = await file.read()
    if len(data) > 1_000_000:
        raise ValidationError("La firma no puede superar 1 MB.")
    key = new_key(user.tenant_id or uuid.UUID(int=0), "signatures", file.filename or "firma.png")
    await storage().put(key, data, file.content_type or "image/png")
    user.signature_key = key
    await session.commit()


@auth_router.post("/me/signature", status_code=status.HTTP_204_NO_CONTENT)
async def upload_my_signature(user: CurrentUserDep, session: SessionDep, file: UploadFile = File(...)) -> None:
    await _save_signature(session, user, file)


@router.get("/permissions", response_model=list[PermissionOut])
async def permissions(_: CtxDep) -> list[PermissionOut]:
    return [PermissionOut(code=p.code, label=p.label, group=p.group) for p in all_permissions()]


# --- Usuarios ---

@router.get("/users", response_model=list[UserOut])
async def list_users(ctx: ManageUsers, session: SessionDep, q: str | None = None) -> list[UserOut]:
    return [user_out(u) for u in await service.list_users(session, ctx, q)]


@router.get("/users/lookup", response_model=list[UserLookup])
async def lookup_users(
    ctx: TenantCtxDep, session: SessionDep, permission: str = "pqrs.manage", area_id: uuid.UUID | None = None
) -> list[UserLookup]:
    """Selector de responsables (asignar PQRS o tareas): usuarios con un permiso dado."""
    users = await service.users_with_permission(session, ctx.tid, permission, area_id)
    return [UserLookup.model_validate(u) for u in users]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, ctx: ManageUsers, session: SessionDep) -> UserOut:
    user = await service.create_user(session, ctx.tid, body.model_dump())
    return user_out(user)


@router.get("/users/{user_id}", response_model=UserOut)
async def get_user(user_id: uuid.UUID, ctx: ManageUsers, session: SessionDep) -> UserOut:
    return user_out(await service.get_user(session, ctx, user_id))


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: uuid.UUID, body: UserUpdate, ctx: ManageUsers, session: SessionDep) -> UserOut:
    return user_out(await service.update_user(session, ctx, user_id, body.model_dump(exclude_unset=True)))


@router.post("/users/{user_id}/signature", status_code=status.HTTP_204_NO_CONTENT)
async def upload_user_signature(
    user_id: uuid.UUID, ctx: ManageUsers, session: SessionDep, file: UploadFile = File(...)
) -> None:
    await _save_signature(session, await service.get_user(session, ctx, user_id), file)


@router.get("/users/{user_id}/signature")
async def get_signature(user_id: uuid.UUID, ctx: TenantCtxDep, session: SessionDep) -> Response:
    user = await session.get(User, user_id)
    if user is None or user.tenant_id != ctx.tid or not user.signature_key:
        raise NotFoundError("Firma no encontrada.")
    return Response(await storage().get(user.signature_key), media_type="image/png")


# --- Roles ---

@router.get("/roles", response_model=list[RoleOut])
async def list_roles(ctx: TenantCtxDep, session: SessionDep) -> list[RoleOut]:
    return [RoleOut.model_validate(r) for r in await service.list_roles(session, ctx)]


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(body: RoleCreate, ctx: ManageRoles, session: SessionDep) -> RoleOut:
    return RoleOut.model_validate(await service.create_role(session, ctx, body.model_dump()))


@router.patch("/roles/{role_id}", response_model=RoleOut)
async def update_role(role_id: uuid.UUID, body: RoleUpdate, ctx: ManageRoles, session: SessionDep) -> RoleOut:
    role = await service.update_role(session, ctx, role_id, body.model_dump(exclude_unset=True))
    return RoleOut.model_validate(role)


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(role_id: uuid.UUID, ctx: ManageRoles, session: SessionDep) -> None:
    await service.delete_role(session, ctx, role_id)


# --- Áreas ---

@router.get("/areas", response_model=list[AreaOut])
async def list_areas(ctx: TenantCtxDep, session: SessionDep) -> list[AreaOut]:
    return [AreaOut.model_validate(a) for a in await service.list_areas(session, ctx)]


@router.post("/areas", response_model=AreaOut, status_code=status.HTTP_201_CREATED)
async def create_area(body: AreaCreate, ctx: ManageAreas, session: SessionDep) -> AreaOut:
    return AreaOut.model_validate(await service.create_area(session, ctx.tid, body.model_dump()))


@router.patch("/areas/{area_id}", response_model=AreaOut)
async def update_area(area_id: uuid.UUID, body: AreaUpdate, ctx: ManageAreas, session: SessionDep) -> AreaOut:
    area = await service.update_area(session, ctx, area_id, body.model_dump(exclude_unset=True))
    return AreaOut.model_validate(area)

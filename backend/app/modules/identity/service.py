"""Usuarios, roles, áreas y autenticación."""

from __future__ import annotations

import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import Ctx
from app.core.db import utcnow
from app.core.errors import ConflictError, NotFoundError, UnauthorizedError, ValidationError
from app.core.permissions import all_codes
from app.core.security import hash_password, verify_password
from app.core.text import slugify
from app.modules.identity.models import Area, Role, User
from app.modules.identity.permissions import SYSTEM_ROLES


def effective_permissions(user: User) -> frozenset[str]:
    if user.is_superadmin:
        return frozenset(all_codes())
    perms: set[str] = set()
    for role in user.roles:
        if role.all_permissions:
            return frozenset(all_codes())
        perms.update(role.permissions or [])
    return frozenset(perms & all_codes())


def ctx_from_user(user: User) -> Ctx:
    return Ctx(
        tenant_id=user.tenant_id,
        user_id=user.id,
        email=user.email,
        name=user.full_name,
        is_superadmin=user.is_superadmin,
        permissions=effective_permissions(user),
        area_ids=tuple(a.id for a in user.areas),
    )


# --- Auth ---

async def authenticate(session: AsyncSession, email: str, password: str) -> User:
    user = (
        await session.execute(select(User).where(User.email == email.lower()))
    ).scalar_one_or_none()
    if user is None or not user.active or not verify_password(password, user.password_hash):
        raise UnauthorizedError("Correo o contraseña incorrectos.")
    user.last_login_at = utcnow()
    await session.commit()
    return user


async def get_active_user(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    user = await session.get(User, user_id)
    return user if user and user.active else None


async def update_me(session: AsyncSession, user: User, data: dict) -> User:
    new_password = data.pop("new_password", None)
    current = data.pop("current_password", None)
    if new_password:
        if not current or not verify_password(current, user.password_hash):
            raise ValidationError("La contraseña actual no es correcta.")
        user.password_hash = hash_password(new_password)
    for key, value in data.items():
        if value is not None:
            setattr(user, key, value)
    await session.commit()
    return user


# --- Siembra de una empresa nueva ---

DEFAULT_AREAS = [
    ("calidad", "Calidad"),
    ("operaciones", "Operaciones"),
    ("gestion_humana", "Gestión Humana"),
    ("facturacion", "Facturación y Cartera"),
    ("servicio_cliente", "Servicio al Cliente"),
    ("sst", "Seguridad y Salud en el Trabajo"),
    ("logistica", "Logística y Dotación"),
]


async def seed_tenant(session: AsyncSession, tenant_id: uuid.UUID) -> None:
    await seed_roles(session, tenant_id)
    for code, name in DEFAULT_AREAS:
        session.add(Area(tenant_id=tenant_id, code=code, name=name))
    await session.flush()


# --- Roles ---

async def seed_roles(session: AsyncSession, tenant_id: uuid.UUID) -> None:
    for spec in SYSTEM_ROLES:
        session.add(
            Role(
                tenant_id=tenant_id,
                code=spec["code"],
                name=spec["name"],
                description=spec.get("description"),
                is_system=True,
                all_permissions=spec.get("all_permissions", False),
                permissions=list(spec.get("permissions", [])),
            )
        )
    await session.flush()


def _validate_perms(perms: list[str]) -> list[str]:
    unknown = set(perms) - all_codes()
    if unknown:
        raise ValidationError(f"Permisos desconocidos: {', '.join(sorted(unknown))}")
    return sorted(set(perms))


async def list_roles(session: AsyncSession, ctx: Ctx) -> list[Role]:
    return list(
        (await session.execute(select(Role).where(Role.tenant_id == ctx.tid).order_by(Role.name))).scalars()
    )


async def _get_role(session: AsyncSession, ctx: Ctx, role_id: uuid.UUID) -> Role:
    role = await session.get(Role, role_id)
    if role is None or role.tenant_id != ctx.tid:
        raise NotFoundError("Rol no encontrado.")
    return role


async def create_role(session: AsyncSession, ctx: Ctx, data: dict) -> Role:
    code = data.get("code") or slugify(data["name"])
    exists = await session.execute(
        select(Role.id).where(Role.tenant_id == ctx.tid, Role.code == code)
    )
    if exists.first():
        raise ConflictError(f"Ya existe un rol con código '{code}'.")
    role = Role(
        tenant_id=ctx.tid,
        code=code,
        name=data["name"],
        description=data.get("description"),
        permissions=_validate_perms(data.get("permissions", [])),
    )
    session.add(role)
    await session.commit()
    return role


async def update_role(session: AsyncSession, ctx: Ctx, role_id: uuid.UUID, data: dict) -> Role:
    role = await _get_role(session, ctx, role_id)
    if role.all_permissions and data.get("permissions") is not None:
        raise ValidationError("El rol Administrador siempre tiene todos los permisos.")
    if data.get("name"):
        role.name = data["name"]
    if "description" in data and data["description"] is not None:
        role.description = data["description"]
    if data.get("permissions") is not None:
        role.permissions = _validate_perms(data["permissions"])
    await session.commit()
    return role


async def delete_role(session: AsyncSession, ctx: Ctx, role_id: uuid.UUID) -> None:
    role = await _get_role(session, ctx, role_id)
    if role.is_system:
        raise ValidationError("Los roles del sistema no se eliminan (puedes editar sus permisos).")
    await session.delete(role)
    await session.commit()


# --- Áreas ---

async def list_areas(session: AsyncSession, ctx: Ctx, include_inactive: bool = True) -> list[Area]:
    stmt = select(Area).where(Area.tenant_id == ctx.tid).order_by(Area.name)
    if not include_inactive:
        stmt = stmt.where(Area.active.is_(True))
    return list((await session.execute(stmt)).scalars())


async def create_area(session: AsyncSession, tenant_id: uuid.UUID, data: dict, commit: bool = True) -> Area:
    code = data.get("code") or slugify(data["name"])
    exists = await session.execute(select(Area.id).where(Area.tenant_id == tenant_id, Area.code == code))
    if exists.first():
        raise ConflictError(f"Ya existe un área con código '{code}'.")
    area = Area(tenant_id=tenant_id, code=code, name=data["name"], email=data.get("email"))
    session.add(area)
    if commit:
        await session.commit()
    else:
        await session.flush()
    return area


async def update_area(session: AsyncSession, ctx: Ctx, area_id: uuid.UUID, data: dict) -> Area:
    area = await session.get(Area, area_id)
    if area is None or area.tenant_id != ctx.tid:
        raise NotFoundError("Área no encontrada.")
    for key in ("name", "email", "active"):
        if data.get(key) is not None:
            setattr(area, key, data[key])
    await session.commit()
    return area


# --- Usuarios ---

async def _roles_by_ids(session: AsyncSession, tenant_id: uuid.UUID, ids: list[uuid.UUID]) -> list[Role]:
    if not ids:
        return []
    roles = list(
        (await session.execute(select(Role).where(Role.tenant_id == tenant_id, Role.id.in_(ids)))).scalars()
    )
    if len(roles) != len(set(ids)):
        raise ValidationError("Algún rol no existe en esta empresa.")
    return roles


async def _areas_by_ids(session: AsyncSession, tenant_id: uuid.UUID, ids: list[uuid.UUID]) -> list[Area]:
    if not ids:
        return []
    areas = list(
        (await session.execute(select(Area).where(Area.tenant_id == tenant_id, Area.id.in_(ids)))).scalars()
    )
    if len(areas) != len(set(ids)):
        raise ValidationError("Alguna área no existe en esta empresa.")
    return areas


async def create_user(
    session: AsyncSession,
    tenant_id: uuid.UUID | None,
    data: dict,
    *,
    role_codes: list[str] | None = None,
    is_superadmin: bool = False,
    commit: bool = True,
) -> User:
    email = data["email"].lower()
    if (await session.execute(select(User.id).where(User.email == email))).first():
        raise ConflictError("Ya existe un usuario con ese correo.")
    user = User(
        tenant_id=tenant_id,
        email=email,
        full_name=data["full_name"],
        phone=data.get("phone"),
        position=data.get("position"),
        password_hash=hash_password(data["password"]),
        is_superadmin=is_superadmin,
    )
    if tenant_id is not None:
        roles = await _roles_by_ids(session, tenant_id, data.get("role_ids", []))
        if role_codes:
            roles += list(
                (
                    await session.execute(
                        select(Role).where(Role.tenant_id == tenant_id, Role.code.in_(role_codes))
                    )
                ).scalars()
            )
        user.roles = roles
        user.areas = await _areas_by_ids(session, tenant_id, data.get("area_ids", []))
    session.add(user)
    if commit:
        await session.commit()
    else:
        await session.flush()
    return user


async def list_users(session: AsyncSession, ctx: Ctx, q: str | None = None) -> list[User]:
    stmt = select(User).where(User.tenant_id == ctx.tid).order_by(User.full_name)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.full_name.ilike(like)))
    return list((await session.execute(stmt)).scalars())


async def get_user(session: AsyncSession, ctx: Ctx, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None or user.tenant_id != ctx.tid:
        raise NotFoundError("Usuario no encontrado.")
    return user


async def list_tenant_users(session: AsyncSession, tenant_id: uuid.UUID) -> list[User]:
    """Usuarios de una empresa (vista del superadministrador)."""
    stmt = select(User).where(User.tenant_id == tenant_id).order_by(User.full_name)
    return list((await session.execute(stmt)).scalars())


async def platform_update_user(session: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, data: dict) -> User:
    """El superadministrador corrige datos de acceso de un usuario de una empresa (correo, nombre, clave, estado)."""
    user = await session.get(User, user_id)
    if user is None or user.tenant_id != tenant_id:
        raise NotFoundError("Usuario no encontrado en esta empresa.")
    email = (data.get("email") or "").strip().lower()
    if email and email != user.email:
        if (await session.execute(select(User.id).where(User.email == email))).first():
            raise ConflictError("Ya existe un usuario con ese correo.")
        user.email = email
    if data.get("password"):
        user.password_hash = hash_password(data["password"])
    for key in ("full_name", "phone", "position", "active"):
        if data.get(key) is not None:
            setattr(user, key, data[key])
    await session.commit()
    return user


def is_tenant_admin(user: User) -> bool:
    return any(r.all_permissions for r in user.roles)


async def update_user(session: AsyncSession, ctx: Ctx, user_id: uuid.UUID, data: dict) -> User:
    user = await get_user(session, ctx, user_id)
    if data.get("password"):
        user.password_hash = hash_password(data["password"])
    for key in ("full_name", "phone", "position", "active"):
        if data.get(key) is not None:
            setattr(user, key, data[key])
    if data.get("role_ids") is not None:
        user.roles = await _roles_by_ids(session, ctx.tid, data["role_ids"])
    if data.get("area_ids") is not None:
        user.areas = await _areas_by_ids(session, ctx.tid, data["area_ids"])
    if user.id == ctx.user_id and user.active is False:
        raise ValidationError("No puedes desactivar tu propio usuario.")
    await session.commit()
    return user


async def users_with_permission(
    session: AsyncSession, tenant_id: uuid.UUID, perm: str, area_id: uuid.UUID | None = None
) -> list[User]:
    """Usuarios activos de la empresa con un permiso (opcionalmente miembros de un área)."""
    users = (
        await session.execute(select(User).where(User.tenant_id == tenant_id, User.active.is_(True)))
    ).scalars()
    result = []
    for user in users:
        if perm not in effective_permissions(user):
            continue
        if area_id is not None and area_id not in {a.id for a in user.areas}:
            continue
        result.append(user)
    return result

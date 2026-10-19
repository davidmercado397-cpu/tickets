"""Auth de usuarios humanos: login (email+password → JWT) y /me.

`POST /auth/login` es público (emite el token); `GET /auth/me` requiere el Bearer. La verificación de
contraseña (scrypt) solo corre en el login; el resto de rutas validan el JWT (barato)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.schemas import LoginIn, MeOut, TokenOut
from app.dependencies import SettingsDep, UserContextDep, UserServiceDep
from app.services.tokens import issue_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", summary="Login (email+password → JWT de sesión)")
async def login(body: LoginIn, service: UserServiceDep, settings: SettingsDep) -> TokenOut:
    user = await service.authenticate(body.email, body.password)
    if user is None:
        # 401 uniforme: no revelamos si el email existe o la contraseña es incorrecta.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas."
        )
    token = issue_access_token(
        user_id=user.id,
        signing_key=settings.AUTH_JWT_SIGNING_KEY,
        ttl_seconds=settings.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    )
    return TokenOut(access_token=token, expires_in=settings.AUTH_ACCESS_TOKEN_TTL_SECONDS)


@router.get("/me", summary="Datos del usuario autenticado")
async def me(user: UserContextDep) -> MeOut:
    return MeOut(
        user_id=str(user.user_id),
        email=user.email,
        display_name=user.display_name,
        role=user.role,
    )

from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.context import Ctx
from app.core.errors import ValidationError
from app.core.security import decrypt_secret
from app.modules.channels.email_inbound import poll_tenant, test_connection
from app.modules.identity.public import SessionDep, require
from app.modules.tenancy.public import get_tenant_info

router = APIRouter(prefix="/channels", tags=["canales"])
SettingsCtx = Annotated[Ctx, Depends(require("tenant.settings"))]


class ResultOut(BaseModel):
    ok: bool
    detail: str


async def _cfg(session, ctx: Ctx) -> tuple[dict, str]:
    tenant = await get_tenant_info(session, ctx.tid)
    cfg = tenant["settings"].get("email_inbound") or {}
    if not (cfg.get("host") and cfg.get("username") and cfg.get("password_enc")):
        raise ValidationError("Configura servidor, usuario y contraseña del buzón primero.")
    return cfg, decrypt_secret(cfg["password_enc"], get_settings().SECRETS_ENCRYPTION_KEY)


@router.post("/email/test", response_model=ResultOut)
async def test_email(ctx: SettingsCtx, session: SessionDep) -> ResultOut:
    cfg, password = await _cfg(session, ctx)
    try:
        await asyncio.to_thread(test_connection, cfg, password)
    except Exception as exc:  # noqa: BLE001 - se informa al usuario
        return ResultOut(ok=False, detail=f"No fue posible conectar: {exc}")
    return ResultOut(ok=True, detail="Conexión exitosa con el buzón.")


@router.post("/email/poll", response_model=ResultOut)
async def poll_now(ctx: SettingsCtx, session: SessionDep) -> ResultOut:
    """Lee el buzón ahora (sin esperar al worker)."""
    cfg, _ = await _cfg(session, ctx)
    await session.close()
    n = await poll_tenant(ctx.tid, cfg)
    return ResultOut(ok=True, detail=f"Se radicaron {n} correo(s).")

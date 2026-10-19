"""Siembra inicial idempotente: superadministrador y (opcional) empresa de demostración."""

from __future__ import annotations

import logging

from sqlalchemy import select

from app.core.config import Settings
from app.core.db import session_factory
from app.core.errors import ConflictError

logger = logging.getLogger(__name__)


async def seed(settings: Settings) -> None:
    from app.modules.identity.models import User
    from app.modules.identity.public import create_user
    from app.modules.tenancy.models import Tenant
    from app.modules.tenancy.service import create_tenant

    async with session_factory()() as session:
        if settings.SEED_SUPERADMIN_EMAIL and settings.SEED_SUPERADMIN_PASSWORD:
            exists = await session.execute(select(User.id).where(User.email == settings.SEED_SUPERADMIN_EMAIL.lower()))
            if not exists.first():
                await create_user(
                    session, None,
                    {"email": settings.SEED_SUPERADMIN_EMAIL, "full_name": "Superadministrador",
                     "password": settings.SEED_SUPERADMIN_PASSWORD},
                    is_superadmin=True,
                )
                logger.info("Superadministrador sembrado")
        if settings.SEED_DEMO_TENANT and settings.SEED_DEMO_ADMIN_PASSWORD:
            if not (await session.execute(select(Tenant.id).where(Tenant.slug == "servigpoder"))).first():
                try:
                    await create_tenant(session, {
                        "name": "Servigpoder", "slug": "servigpoder", "legal_name": "Servigpoder Ltda",
                        "radicado_prefix": "SGP", "city": "Santiago de Cali",
                        "admin_email": settings.SEED_DEMO_ADMIN_EMAIL, "admin_full_name": "Administrador Servigpoder",
                        "admin_password": settings.SEED_DEMO_ADMIN_PASSWORD,
                    })
                    logger.info("Empresa de demostración sembrada (servigpoder)")
                except ConflictError as exc:
                    logger.warning("No se sembró la empresa demo: %s", exc)

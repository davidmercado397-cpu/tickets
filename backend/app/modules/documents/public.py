"""Fachada pública del módulo de documentos (generación de PDFs)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.core.storage import storage
from app.modules.documents.letters import build_letter, date_es, latin1  # noqa: F401

logger = logging.getLogger(__name__)


async def _fetch(key: str | None) -> bytes | None:
    if not key:
        return None
    try:
        return await storage().get(key)
    except Exception:  # noqa: BLE001 - un logo/firma faltante no impide la carta
        logger.warning("No se pudo leer %s del almacenamiento", key)
        return None


async def render_response_letter(*, tenant: dict, case: dict, body: str, signer: dict | None, draft: bool = False) -> bytes:
    return build_letter(
        tenant=tenant,
        case=case,
        body=body,
        signer=signer,
        logo=await _fetch(tenant.get("logo_key")),
        signature=await _fetch((signer or {}).get("signature_key")),
        now=datetime.now(timezone.utc),
        draft=draft,
    )


async def render_rca_report(*, tenant: dict, case: dict, rca: dict) -> bytes:
    from app.modules.documents.rca_report import build_rca_report

    return build_rca_report(tenant=tenant, case=case, rca=rca, logo=await _fetch(tenant.get("logo_key")),
                            now=datetime.now(timezone.utc))

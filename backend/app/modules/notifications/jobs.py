"""Trabajos del worker de este módulo."""

from __future__ import annotations

import logging

from app.core.config import get_settings
from app.core.jobs import job
from app.core.mailer import send_mail
from app.core.storage import storage

logger = logging.getLogger(__name__)


@job("send_email")
async def send_email(payload: dict) -> None:
    attachments = []
    for att in payload.get("attachments") or []:
        try:
            attachments.append((att["filename"], await storage().get(att["key"]), att["mime"]))
        except Exception:  # noqa: BLE001
            logger.exception("Adjunto de correo no disponible: %s", att.get("key"))
    await send_mail(
        get_settings(),
        to=payload["to"],
        subject=payload["subject"],
        html=payload["html"],
        attachments=attachments,
        sender_name=payload.get("sender_name"),
    )
    logger.info("Correo enviado", extra={"subject": payload["subject"], "recipients": len(payload["to"])})

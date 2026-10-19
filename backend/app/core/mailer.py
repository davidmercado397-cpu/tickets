"""Envío de correo por SMTP (Mailpit en local, proveedor real en la nube)."""

from __future__ import annotations

import logging
from email.message import EmailMessage

from app.core.config import Settings

logger = logging.getLogger(__name__)


async def send_mail(
    settings: Settings,
    *,
    to: list[str],
    subject: str,
    html: str,
    attachments: list[tuple[str, bytes, str]] | None = None,
    sender_name: str | None = None,
) -> None:
    if not settings.smtp_configured:
        logger.info("SMTP sin configurar; correo omitido", extra={"subject": subject})
        return
    import aiosmtplib

    msg = EmailMessage()
    msg["From"] = f"{sender_name} <{settings.SMTP_FROM}>" if sender_name else settings.SMTP_FROM
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    msg.set_content("Este mensaje requiere un cliente de correo con soporte HTML.")
    msg.add_alternative(html, subtype="html")
    for filename, data, mime in attachments or []:
        maintype, _, subtype = mime.partition("/")
        msg.add_attachment(data, maintype=maintype, subtype=subtype or "octet-stream", filename=filename)

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USERNAME or None,
        password=settings.SMTP_PASSWORD or None,
        use_tls=settings.SMTP_USE_TLS,
        start_tls=settings.SMTP_START_TLS,
    )

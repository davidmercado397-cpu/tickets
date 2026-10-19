"""Canal de correo entrante: lee el buzón IMAP de cada empresa y radica cada correo como PQRS."""

from __future__ import annotations

import asyncio
import email
import imaplib
import logging
import re
from email.message import EmailMessage
from email.policy import default as default_policy
from email.utils import parseaddr
from html import unescape

from app.core.config import get_settings
from app.core.db import session_factory
from app.core.security import decrypt_secret
from app.modules.catalog import public as catalog
from app.modules.pqrs import public as pqrs
from app.modules.tenancy import public as tenancy

logger = logging.getLogger(__name__)
MAX_PER_RUN = 25


def _html_to_text(html: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?</\1>", "", html)
    text = re.sub(r"(?i)<br\s*/?>|</p>", "\n", text)
    return unescape(re.sub(r"<[^>]+>", "", text)).strip()


def parse_message(raw: bytes) -> dict:
    msg: EmailMessage = email.message_from_bytes(raw, policy=default_policy)  # type: ignore[assignment]
    name, addr = parseaddr(str(msg.get("From", "")))
    body_part = msg.get_body(preferencelist=("plain", "html"))
    body = ""
    if body_part is not None:
        content = body_part.get_content()
        body = content if body_part.get_content_type() == "text/plain" else _html_to_text(content)
    files = []
    for part in msg.iter_attachments():
        filename = part.get_filename()
        if filename:
            files.append(pqrs.UploadedFile(filename, part.get_content_type(), part.get_payload(decode=True) or b""))
    return {
        "message_id": str(msg.get("Message-ID", "")).strip()[:250] or None,
        "subject": (str(msg.get("Subject", "")) or "(sin asunto)").strip()[:250],
        "from_name": name or addr,
        "from_email": addr,
        "body": body.strip() or "(correo sin contenido de texto)",
        "files": files,
    }


def _fetch_unseen(cfg: dict, password: str) -> list[tuple[bytes, bytes]]:
    """IMAP es bloqueante: se ejecuta en un hilo. Devuelve [(uid, raw)]."""
    cls = imaplib.IMAP4_SSL if cfg.get("use_ssl", True) else imaplib.IMAP4
    conn = cls(cfg["host"], int(cfg.get("port") or 993))
    try:
        conn.login(cfg["username"], password)
        conn.select(cfg.get("folder") or "INBOX")
        _, data = conn.uid("search", None, "UNSEEN")
        out = []
        for uid in (data[0] or b"").split()[:MAX_PER_RUN]:
            _, msg_data = conn.uid("fetch", uid, "(BODY.PEEK[])")
            if msg_data and isinstance(msg_data[0], tuple):
                out.append((uid, msg_data[0][1]))
        return out
    finally:
        try:
            conn.logout()
        except Exception:  # noqa: BLE001
            pass


def _mark_seen(cfg: dict, password: str, uids: list[bytes]) -> None:
    if not uids:
        return
    cls = imaplib.IMAP4_SSL if cfg.get("use_ssl", True) else imaplib.IMAP4
    conn = cls(cfg["host"], int(cfg.get("port") or 993))
    try:
        conn.login(cfg["username"], password)
        conn.select(cfg.get("folder") or "INBOX")
        for uid in uids:
            conn.uid("store", uid, "+FLAGS", "(\\Seen)")
    finally:
        try:
            conn.logout()
        except Exception:  # noqa: BLE001
            pass


def test_connection(cfg: dict, password: str) -> None:
    cls = imaplib.IMAP4_SSL if cfg.get("use_ssl", True) else imaplib.IMAP4
    conn = cls(cfg["host"], int(cfg.get("port") or 993))
    try:
        conn.login(cfg["username"], password)
        conn.select(cfg.get("folder") or "INBOX")
    finally:
        try:
            conn.logout()
        except Exception:  # noqa: BLE001
            pass


async def poll_tenant(tenant_id, cfg: dict) -> int:
    password = decrypt_secret(cfg["password_enc"], get_settings().SECRETS_ENCRYPTION_KEY)
    messages = await asyncio.to_thread(_fetch_unseen, cfg, password)
    processed: list[bytes] = []
    created = 0
    for uid, raw in messages:
        try:
            data = parse_message(raw)
            async with session_factory()() as session:
                if data["message_id"] and await pqrs.exists_external_ref(session, tenant_id, data["message_id"]):
                    processed.append(uid)
                    continue
                type_id = await catalog.request_type_by_code(session, tenant_id, "peticion")
                if type_id is None:
                    logger.error("Empresa sin tipo 'peticion'; no se radica el correo")
                    continue
                await pqrs.create_pqrs(
                    session, tenant_id,
                    {
                        "segment": "external", "request_type_id": type_id, "subject": data["subject"],
                        "description": data["body"], "external_ref": data["message_id"],
                        "requester": {"name": data["from_name"], "email": data["from_email"]},
                        "consent": True,
                    },
                    ctx=None, channel="email", files=data["files"][:10], actor_label=data["from_email"],
                )
                created += 1
            processed.append(uid)
        except Exception:  # noqa: BLE001 - un correo malo no detiene el buzón
            logger.exception("No se pudo radicar un correo entrante")
    await asyncio.to_thread(_mark_seen, cfg, password, processed)
    return created


async def poll_all() -> None:
    async with session_factory()() as session:
        tenants = await tenancy.active_tenants(session)
    for t in tenants:
        cfg = (t.settings or {}).get("email_inbound") or {}
        if not (cfg.get("enabled") and cfg.get("host") and cfg.get("username") and cfg.get("password_enc")):
            continue
        try:
            n = await poll_tenant(t.id, cfg)
            if n:
                logger.info("Correos radicados", extra={"tenant_id": str(t.id), "count": n})
        except Exception:  # noqa: BLE001
            logger.exception("Fallo leyendo el buzón IMAP", extra={"tenant_id": str(t.id)})

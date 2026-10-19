"""Envío de email por SMTP (aiosmtplib). Proveedor genérico.

Si el SMTP no está configurado, el canal email ni siquiera se monta (ver dependencies). Este adapter
asume config válida."""

from __future__ import annotations

from email.message import EmailMessage

import aiosmtplib


class SmtpEmailSender:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        username: str,
        password: str,
        sender: str,
        use_tls: bool,
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._sender = sender
        self._use_tls = use_tls

    async def send(self, *, to: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["From"] = self._sender
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)
        await aiosmtplib.send(
            message,
            hostname=self._host,
            port=self._port,
            username=self._username or None,
            password=self._password or None,
            start_tls=self._use_tls,
        )

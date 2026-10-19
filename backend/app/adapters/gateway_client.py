"""Cliente del WhatsApp Gateway (POST /send). Lo usa el canal WhatsApp de notificaciones.

Envía una **plantilla aprobada** (los empleados no están en la ventana de 24h de Meta). Reintenta solo
en errores transitorios (429/5xx/red) con backoff (tenacity) y timeout. Usa el httpx.AsyncClient único
compartido."""

from __future__ import annotations

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential


def _is_transient(exc: BaseException) -> bool:
    if isinstance(exc, httpx.TransportError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        return code == 429 or code >= 500
    return False


class HttpGatewayClient:
    def __init__(
        self,
        client: httpx.AsyncClient,
        base_url: str,
        internal_key: str,
        phone_number_id: str = "",
    ) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._internal_key = internal_key
        self._phone_number_id = phone_number_id

    @retry(
        retry=retry_if_exception(_is_transient),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, max=5),
        reraise=True,
    )
    async def send_template(
        self, *, to: str, template: str, language: str, body_params: list[str]
    ) -> None:
        payload: dict = {
            "type": "template",
            "to": to,
            "name": template,
            "language": language,
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": p} for p in body_params],
                }
            ],
        }
        if self._phone_number_id:
            payload["phone_number_id"] = self._phone_number_id
        resp = await self._client.post(
            f"{self._base_url}/send",
            json=payload,
            headers={"X-Internal-Key": self._internal_key},
            timeout=httpx.Timeout(10.0, connect=5.0),
        )
        resp.raise_for_status()

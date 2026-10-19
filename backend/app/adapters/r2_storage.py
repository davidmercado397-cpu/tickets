"""Almacenamiento en Cloudflare R2 (S3-compatible) con aioboto3. Implementa `ObjectStorage`.

Import perezoso de aioboto3 (solo se importa este módulo si R2 está configurado). Sube el PDF y firma
una URL GET temporal que el bot entrega por WhatsApp (Meta la descarga de Cloudflare, no de la app)."""

from __future__ import annotations

import aioboto3


class R2ObjectStorage:
    def __init__(
        self,
        *,
        endpoint_url: str,
        bucket: str,
        access_key_id: str,
        secret_access_key: str,
        region: str,
    ) -> None:
        self._session = aioboto3.Session()
        self._endpoint = endpoint_url
        self._bucket = bucket
        self._key = access_key_id
        self._secret = secret_access_key
        self._region = region

    def _client(self):
        return self._session.client(
            "s3",
            endpoint_url=self._endpoint,
            aws_access_key_id=self._key,
            aws_secret_access_key=self._secret,
            region_name=self._region,
        )

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        async with self._client() as client:
            await client.put_object(
                Bucket=self._bucket, Key=key, Body=data, ContentType=content_type
            )

    async def signed_url(self, key: str, ttl_seconds: int) -> str:
        async with self._client() as client:
            return await client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=ttl_seconds,
            )

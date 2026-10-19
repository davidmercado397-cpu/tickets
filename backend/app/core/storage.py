"""Almacenamiento de objetos S3-compatible (SeaweedFS en local; R2/S3 en la nube).

Los archivos NUNCA se exponen directo al navegador: la API los descarga y los sirve tras validar
permisos. Así el endpoint de almacenamiento puede ser interno."""

from __future__ import annotations

import logging
import uuid

from app.core.config import Settings
from app.core.errors import ServiceUnavailableError

logger = logging.getLogger(__name__)


class ObjectStorage:
    def __init__(self, settings: Settings) -> None:
        import aioboto3

        self._session = aioboto3.Session()
        self._kw = dict(
            service_name="s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
            region_name=settings.S3_REGION,
        )
        self.bucket = settings.S3_BUCKET

    async def ensure_bucket(self) -> None:
        async with self._session.client(**self._kw) as s3:
            try:
                await s3.head_bucket(Bucket=self.bucket)
            except Exception:  # noqa: BLE001
                await s3.create_bucket(Bucket=self.bucket)
                logger.info("Bucket creado: %s", self.bucket)

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        async with self._session.client(**self._kw) as s3:
            await s3.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    async def get(self, key: str) -> bytes:
        async with self._session.client(**self._kw) as s3:
            obj = await s3.get_object(Bucket=self.bucket, Key=key)
            async with obj["Body"] as stream:
                return await stream.read()

    async def delete(self, key: str) -> None:
        async with self._session.client(**self._kw) as s3:
            await s3.delete_object(Bucket=self.bucket, Key=key)


class MemoryStorage:
    """Almacenamiento en memoria (tests y arranque sin S3 configurado)."""

    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}

    async def ensure_bucket(self) -> None:
        return None

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = (data, content_type)

    async def get(self, key: str) -> bytes:
        if key not in self.objects:
            raise ServiceUnavailableError("Archivo no disponible.")
        return self.objects[key][0]

    async def delete(self, key: str) -> None:
        self.objects.pop(key, None)


_storage: ObjectStorage | MemoryStorage | None = None


def init_storage(settings: Settings) -> ObjectStorage | MemoryStorage:
    global _storage
    if settings.storage_configured:
        _storage = ObjectStorage(settings)
    else:
        logger.warning("S3 sin configurar: se usa almacenamiento en memoria (NO usar en producción).")
        _storage = MemoryStorage()
    return _storage


def storage() -> ObjectStorage | MemoryStorage:
    if _storage is None:
        raise ServiceUnavailableError("Almacenamiento no inicializado.")
    return _storage


def new_key(tenant_id: uuid.UUID, folder: str, filename: str) -> str:
    safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in filename)[-80:] or "archivo"
    return f"{tenant_id}/{folder}/{uuid.uuid4().hex}_{safe}"

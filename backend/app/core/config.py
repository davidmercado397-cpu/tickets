"""Configuración de infraestructura vía variables de entorno (pydantic-settings).

Solo infraestructura y secretos. La configuración de NEGOCIO (empresas, catálogos, SLA, formularios…)
vive en la base de datos y se gestiona desde la app. Local y nube usan el mismo compose: solo cambia
el `.env`."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    # --- Obligatorias (fail-fast en el arranque) ---
    DATABASE_URL: str = ""
    # Firma de los JWT de sesión (HS256, >= 32 bytes).
    AUTH_JWT_SIGNING_KEY: str = ""

    APP_NAME: str = "PQRS Seguridad"
    API_PREFIX: str = "/api"
    # URL pública del frontend: se usa en correos (enlace al portal de consulta).
    PUBLIC_BASE_URL: str = "http://localhost:8080"
    CORS_ORIGINS: str = ""
    AUTH_ACCESS_TOKEN_TTL_SECONDS: int = 28800  # 8 h = una jornada

    # Superadministrador de la plataforma (se siembra al arrancar si no existe; idempotente).
    SEED_SUPERADMIN_EMAIL: str = ""
    SEED_SUPERADMIN_PASSWORD: str = ""
    # Empresa de demostración (se siembra con su admin si se configuran). Útil en local.
    SEED_DEMO_TENANT: bool = False
    SEED_DEMO_ADMIN_EMAIL: str = "admin@servigpoder.co"
    SEED_DEMO_ADMIN_PASSWORD: str = ""

    REDIS_URL: str = "redis://redis:6379/0"
    SSE_HEARTBEAT_SECONDS: float = 15.0

    # --- Almacenamiento S3-compatible (SeaweedFS en local, R2/S3 en la nube) ---
    S3_ENDPOINT_URL: str = ""
    S3_BUCKET: str = "pqrs"
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_REGION: str = "us-east-1"
    MAX_UPLOAD_MB: int = 15

    # --- Correo saliente (SMTP). En local apunta a Mailpit. ---
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_START_TLS: bool = False

    # Cifrado en reposo (Fernet) de secretos de cada empresa (p. ej. clave IMAP).
    SECRETS_ENCRYPTION_KEY: str = ""

    # --- Worker ---
    WORKER_IMAP_POLL_SECONDS: int = 120
    WORKER_SLA_SCAN_SECONDS: int = 900

    # Portal público: límite de radicaciones por IP y hora (anti-abuso).
    PUBLIC_RATE_LIMIT_PER_HOUR: int = 20

    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    LOG_TZ_OFFSET_HOURS: int = -5

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def storage_configured(self) -> bool:
        return bool(self.S3_ENDPOINT_URL and self.S3_ACCESS_KEY_ID and self.S3_SECRET_ACCESS_KEY)

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_FROM)


@lru_cache
def get_settings() -> Settings:
    return Settings()

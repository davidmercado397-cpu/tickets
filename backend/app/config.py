"""Configuración del servicio Ticketing vía variables de entorno (pydantic-settings).

Los secretos llegan SIEMPRE por entorno (Coolify), nunca viven en el repo. La config de NEGOCIO
(áreas, categorías, reglas) NO vive aquí: vive en la base de datos (config-as-data) y se gestiona por
la API. El entorno solo guarda infraestructura y secretos de la app."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración tipada. Se lee del entorno (y de un .env en desarrollo)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Obligatorias (fail-fast en el arranque, ver main.lifespan) ---
    # Base de datos. Ej: postgresql+asyncpg://user:pass@host:5432/db
    DATABASE_URL: str = ""
    # Token de servicio (Bearer) con el que el Gateway llama a esta API.
    TICKETING_SERVICE_TOKEN: str = ""

    # --- API / radicado ---
    # Prefijo base de la API (el contrato del bot cuelga de aquí): /api/tickets, /api/areas, ...
    API_PREFIX: str = "/api"
    # CORS: orígenes del FRONT permitidos (coma-separados). El bot/Gateway es server-to-server y no lo
    # necesita. Ej: https://tickets.nextbyte.com,http://localhost:5173. Vacío = sin CORS (solo same-origin).
    CORS_ORIGINS: str = ""
    # Prefijo del número de radicado: {PREFIX}-{YYYY}-{NNNNNN}.
    RADICADO_PREFIX: str = "SRV"
    # Prioridad por defecto (para clasificar y aplicar SLA) cuando el bot no la manda.
    DEFAULT_PRIORITY: str = "medium"

    # --- Auth de usuarios humanos (RBAC del front) ---
    # Clave de firma de los JWT de sesión (HS256). OBLIGATORIA (>=32 bytes), fail-fast en arranque.
    AUTH_JWT_SIGNING_KEY: str = ""
    # Vida del token de sesión. 8h = una jornada laboral (sin refresh por ahora).
    AUTH_ACCESS_TOKEN_TTL_SECONDS: int = 28800
    # Semilla del primer usuario admin: se crea en el arranque si no existe (idempotente). Setéalos en
    # Coolify para el bootstrap; luego ese admin gestiona todo desde /api/users.
    SEED_ADMIN_EMAIL: str = ""
    SEED_ADMIN_PASSWORD: str = ""

    # --- Notificaciones (inc 3) ---
    # El canal in-app está SIEMPRE activo (núcleo). WhatsApp/email se activan por config.
    NOTIFY_WHATSAPP_ENABLED: bool = False
    NOTIFY_EMAIL_ENABLED: bool = False
    # Heartbeat del stream SSE del inbox de notificaciones (segundos).
    SSE_HEARTBEAT_SECONDS: float = 15.0
    # WhatsApp a empleados vía el POST /send del Gateway (plantilla aprobada; fuera de la ventana 24h).
    WHATSAPP_TEMPLATE_NAME: str = ""
    WHATSAPP_TEMPLATE_LANG: str = "es"
    WHATSAPP_PHONE_NUMBER_ID: str = ""  # opcional: número emisor del Gateway
    # SMTP (email). Proveedor genérico; si no se configura, el canal email queda inerte.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def whatsapp_configured(self) -> bool:
        return bool(
            self.NOTIFY_WHATSAPP_ENABLED
            and self.GATEWAY_BASE_URL
            and self.GATEWAY_INTERNAL_KEY
            and self.WHATSAPP_TEMPLATE_NAME
        )

    @property
    def email_configured(self) -> bool:
        return bool(self.NOTIFY_EMAIL_ENABLED and self.SMTP_HOST and self.SMTP_FROM)

    # --- Evento de vuelta al usuario final (B3): avisar al solicitante por WhatsApp al cambiar el caso ---
    NOTIFY_USER_ENABLED: bool = False
    USER_EVENT_TEMPLATE_NAME: str = ""
    USER_EVENT_TEMPLATE_LANG: str = "es"
    # Estados que disparan el aviso al usuario (coma-separados). Por defecto: al cerrar.
    NOTIFY_USER_STATUSES: str = "closed"

    @property
    def user_event_configured(self) -> bool:
        return bool(
            self.NOTIFY_USER_ENABLED
            and self.GATEWAY_BASE_URL
            and self.GATEWAY_INTERNAL_KEY
            and self.USER_EVENT_TEMPLATE_NAME
        )

    @property
    def notify_user_statuses(self) -> set[str]:
        return {s.strip() for s in self.NOTIFY_USER_STATUSES.split(",") if s.strip()}

    # --- Almacenamiento propio en R2 (S3-compatible) — documentos que el Ticketing GENERA (PDFs) ---
    R2_ENDPOINT_URL: str = ""  # https://<accountid>.r2.cloudflarestorage.com
    R2_BUCKET: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_REGION: str = "auto"
    # Vida de la URL firmada del PDF que se entrega al bot (segundos).
    R2_SIGNED_URL_TTL_SECONDS: int = 3600

    @property
    def r2_configured(self) -> bool:
        return bool(
            self.R2_BUCKET
            and self.R2_ENDPOINT_URL
            and self.R2_ACCESS_KEY_ID
            and self.R2_SECRET_ACCESS_KEY
        )

    # --- Certificado laboral (generación documental) ---
    # Categoría (code) del catálogo bajo la que se registra cada emisión como ticket.
    CERTIFICATE_CATEGORY_CODE: str = "certificado_laboral"
    # Textos fijos del certificado (defaults del ejemplo de Servigpoder). Sobrescribibles por entorno.
    CERT_ORG_HEADER: str = (
        "LA SUSCRITA DIRECCIÓN DE GESTION HUMANA\n"
        "Y LA EMPRESA DE VIGILANCIA SERVIGPODER LTDA"
    )
    CERT_SIGNATORY_NAME: str = "ANGELICA PATRICIA GOMEZ ALZATE"
    CERT_SIGNATORY_TITLE: str = "Auxiliar de servicio de cliente interno"
    CERT_FOOTER_WHATSAPP: str = "3135877576"
    CERT_CITY: str = "Santiago de Cali"  # ciudad fija de expedición
    CERT_LOGO_PATH: str = ""  # ruta a un PNG de logo/membrete (opcional)

    # --- Gateway (WhatsApp saliente): notificaciones staff + evento de vuelta ---
    GATEWAY_BASE_URL: str = ""
    # Clave interna del GATEWAY (su INTERNAL_API_KEY): la enviamos como X-Internal-Key a su POST /send.
    GATEWAY_INTERNAL_KEY: str = ""

    # --- Reservadas (groundwork) ---
    # Caché efímero / bus SSE de notificaciones.
    REDIS_URL: str = "redis://redis:6379/0"
    # Cifrado en reposo (Fernet) para secretos que deban descifrarse.
    SECRETS_ENCRYPTION_KEY: str = ""

    # --- Logging ---
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # "json" o "text" (text solo para depurar en local)
    # Desfase horario de los timestamps/radicado. Colombia = -5 (GMT-5, sin horario de verano).
    LOG_TZ_OFFSET_HOURS: int = -5


@lru_cache
def get_settings() -> Settings:
    """Singleton de configuración. Cacheado para no releer el entorno en cada request.

    Se usa como dependencia de FastAPI (Depends) y como composition root."""
    return Settings()

"""Logging estructurado en JSON (una línea por evento) hacia stdout.

Coolify (o el agregador) recoge stdout. Los logs operativos JAMÁS van a la BD de dominio. NUNCA se
loguean secretos ni PII completa: para eso está el helper `truncate`."""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timedelta, timezone

# Campos contextuales que viajan por `extra` y, si están, se incluyen en la línea JSON (correlación).
_CONTEXT_FIELDS = (
    "radicado",
    "ticket_id",
    "conversation_id",
    "category",
    "area",
)

# Atributos estándar de LogRecord que NO queremos volcar como campos extra.
_RESERVED = set(logging.makeLogRecord({}).__dict__.keys()) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    """Formateador que emite cada registro como un objeto JSON de una sola línea."""

    def __init__(self, tz: timezone | None = None) -> None:
        super().__init__()
        self._tz = tz or timezone.utc

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=self._tz).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for field in _CONTEXT_FIELDS:
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        for key, value in record.__dict__.items():
            if key not in _RESERVED and key not in payload and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


class AccessLogNoiseFilter(logging.Filter):
    """Filtra el ruido del log de acceso de uvicorn: healthchecks y 404 de escáneres."""

    _HEALTH_PATHS = {"/health", "/ready"}

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if not isinstance(args, tuple) or len(args) < 5:
            return True
        path = str(args[2]).split("?", 1)[0]
        if path in self._HEALTH_PATHS:
            return False
        try:
            if int(args[4]) == 404:
                return False
        except (TypeError, ValueError):
            pass
        return True


def configure_logging(level: str = "INFO", fmt: str = "json", tz_offset_hours: int = 0) -> None:
    """Configura el logging raíz una sola vez (idempotente). Llamado desde el lifespan.

    tz_offset_hours: desfase fijo para los timestamps (Colombia = -5, sin horario de verano)."""
    root = logging.getLogger()
    root.setLevel(level.upper())
    for handler in list(root.handlers):
        root.removeHandler(handler)

    tz = timezone(timedelta(hours=tz_offset_hours))
    handler = logging.StreamHandler(sys.stdout)
    if fmt == "json":
        handler.setFormatter(JsonFormatter(tz))
    else:
        text_formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
        text_formatter.converter = lambda secs: datetime.fromtimestamp(secs, tz).timetuple()
        handler.setFormatter(text_formatter)
    root.addHandler(handler)

    for noisy in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(noisy).handlers.clear()
        logging.getLogger(noisy).propagate = True

    access_logger = logging.getLogger("uvicorn.access")
    access_logger.filters.clear()
    access_logger.addFilter(AccessLogNoiseFilter())


def truncate(text: str | None, limit: int = 64) -> str:
    """Recorta contenido potencialmente sensible para que sea seguro loguearlo."""
    if not text:
        return ""
    text = text.replace("\n", " ")
    return text if len(text) <= limit else text[:limit] + "…"

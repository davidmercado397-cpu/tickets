"""Tipo UUID portable entre PostgreSQL (uuid nativo) y SQLite (CHAR(32)).

Usamos UUID como clave primaria. Postgres tiene tipo `uuid` nativo; SQLite no, y los tests corren
sobre aiosqlite. Este `TypeDecorator` hace el round-trip transparente: en Python siempre se trabaja
con objetos `uuid.UUID`, sin importar el motor.

No importa módulos del proyecto a propósito (solo SQLAlchemy + uuid) para evitar ciclos."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.engine import Dialect
from sqlalchemy.types import CHAR, TypeDecorator


class GUID(TypeDecorator):
    """UUID nativo en Postgres; CHAR(32) hex (sin guiones) en el resto (SQLite en tests)."""

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect: Dialect) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(32))

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return None
        if not isinstance(value, uuid.UUID):
            value = uuid.UUID(str(value))
        if dialect.name == "postgresql":
            return value  # el driver acepta el objeto uuid directamente
        return value.hex  # SQLite: 32 chars hex, sin guiones

    def process_result_value(self, value: Any, dialect: Dialect) -> uuid.UUID | None:
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))

"""Formatos en español para el certificado: fecha larga, fecha corta y cédula con puntos."""

from __future__ import annotations

from datetime import date

_MONTHS_ES = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)


def long_date_es(d: date) -> str:
    """`23 de junio del 2026` (como en el certificado de ejemplo)."""
    return f"{d.day} de {_MONTHS_ES[d.month - 1]} del {d.year}"


def short_date(d: date) -> str:
    """`dd/mm/aaaa`."""
    return d.strftime("%d/%m/%Y")


def format_document(document: str) -> str:
    """`94313648` → `94.313.648` (miles con puntos). Solo si es puramente numérico (con o sin puntos ya);
    documentos alfanuméricos (cédula de extranjería, NIT con letras) se dejan igual."""
    cleaned = document.replace(".", "").replace(" ", "").strip()
    if cleaned.isdigit():
        return f"{int(cleaned):,}".replace(",", ".")
    return document

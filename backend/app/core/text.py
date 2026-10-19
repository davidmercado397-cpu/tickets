"""Utilidades de texto compartidas."""

from __future__ import annotations

import re
import unicodedata


def slugify(value: str, max_len: int = 40, sep: str = "_") -> str:
    """'Gestión Humana' → 'gestion_humana'. Quita tildes/ñ y deja [a-z0-9_-]."""
    norm = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", sep, norm).strip(sep)
    slug = slug[:max_len].strip(sep)
    return slug if len(slug) >= 2 else (slug + "xx")[:2]

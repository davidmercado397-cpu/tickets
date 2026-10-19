"""slugify propio (sin dependencia pesada): normaliza un nombre a un `code` sugerido.

"Recursos Humanos" -> "recursos_humanos"; "Formación" -> "formacion". El resultado respeta el formato
de `code` (^[a-z0-9_-]{2,40}$) salvo la longitud mínima (un nombre muy corto puede dar <2 chars: el
llamante valida)."""

from __future__ import annotations

import re
import unicodedata

# Formato público del code: minúsculas, dígitos, guion bajo y medio; 2..40 chars.
CODE_RE = re.compile(r"^[a-z0-9_-]{2,40}$")

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    """Sugerencia de code a partir del nombre. No garantiza unicidad ni longitud mínima."""
    # NFKD + drop de diacríticos: "Formación" -> "Formacion".
    normalized = unicodedata.normalize("NFKD", text)
    ascii_str = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = _NON_ALNUM.sub("_", ascii_str).strip("_")
    return slug[:40]


def is_valid_code(code: str) -> bool:
    return bool(CODE_RE.match(code))

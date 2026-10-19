"""Hash de contraseñas de un solo sentido (scrypt, stdlib).

La contraseña NUNCA se guarda en claro: se almacena su hash scrypt + salt. scrypt es memory-hard y
viene en la librería estándar (sin dependencias nuevas). La verificación compara en tiempo constante."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import secrets

# Parámetros scrypt (interactivos, ~16 MiB). Si se cambian, versionar el hash guardado.
_N = 2**14
_R = 8
_P = 1
_DKLEN = 32
_SALT_BYTES = 16


def hash_password(password: str) -> tuple[str, str]:
    """Devuelve `(salt_b64, hash_b64)` para guardar en BD."""
    salt = secrets.token_bytes(_SALT_BYTES)
    dk = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=_N, r=_R, p=_P, dklen=_DKLEN)
    return base64.b64encode(salt).decode("ascii"), base64.b64encode(dk).decode("ascii")


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    """True si `password` coincide con el hash guardado. Comparación en tiempo constante."""
    try:
        salt_bytes = base64.b64decode(salt)
        expected = base64.b64decode(expected_hash)
    except (ValueError, binascii.Error):
        return False
    dk = hashlib.scrypt(password.encode("utf-8"), salt=salt_bytes, n=_N, r=_R, p=_P, dklen=_DKLEN)
    return hmac.compare_digest(dk, expected)

"""Contraseñas (scrypt), JWT de sesión, API keys y cifrado de secretos."""

from __future__ import annotations

import base64
import binascii
import datetime as dt
import hashlib
import hmac
import secrets
import uuid
from typing import Any

import jwt

# scrypt interactivo (~16 MiB). Si cambian, versionar el hash.
_N, _R, _P, _DKLEN, _SALT = 2**14, 8, 1, 32, 16
_ALGO = "HS256"


def hash_password(password: str) -> str:
    """Devuelve `salt$hash` en base64."""
    salt = secrets.token_bytes(_SALT)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=_DKLEN)
    return f"{base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_b64, hash_b64 = stored.split("$", 1)
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(hash_b64)
    except (ValueError, binascii.Error):
        return False
    dk = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=_DKLEN)
    return hmac.compare_digest(dk, expected)


def issue_access_token(user_id: uuid.UUID, signing_key: str, ttl_seconds: int) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + dt.timedelta(seconds=ttl_seconds),
    }
    return jwt.encode(payload, signing_key, algorithm=_ALGO)


def decode_access_token(token: str, signing_key: str) -> dict[str, Any]:
    """Lanza `jwt.PyJWTError` si expiró o la firma es inválida."""
    return jwt.decode(token, signing_key, algorithms=[_ALGO])


def new_api_key() -> tuple[str, str, str]:
    """Genera una API key. Devuelve (clave en claro, prefijo visible, hash sha256).

    Solo el hash se guarda; la clave en claro se muestra UNA vez al crearla."""
    raw = "pk_" + secrets.token_urlsafe(32)
    return raw, raw[:10], hash_api_key(raw)


def hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def random_code(length: int = 8) -> str:
    """Código legible (sin caracteres ambiguos) para consultar un radicado en el portal."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _fernet(key: str):
    from cryptography.fernet import Fernet

    return Fernet(key.encode())


def encrypt_secret(value: str, key: str) -> str:
    if not key:
        raise RuntimeError("SECRETS_ENCRYPTION_KEY no configurada.")
    return _fernet(key).encrypt(value.encode()).decode()


def decrypt_secret(token: str, key: str) -> str:
    return _fernet(key).decrypt(token.encode()).decode()

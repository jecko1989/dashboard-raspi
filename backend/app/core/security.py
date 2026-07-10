"""Utility di sicurezza: hashing password e JWT.

FASE 1: skeleton. Le funzioni sono definite ma NON ancora applicate come
dipendenze sugli endpoint. L'enforcement dell'autenticazione verra' aggiunto
in una fase successiva.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import jwt

from app.core.config import get_settings

# bcrypt gestisce al massimo 72 byte di password.
_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    """Ritorna l'hash bcrypt della password. Le password NON vanno mai salvate in chiaro."""
    pw = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una password in chiaro contro il suo hash bcrypt."""
    try:
        pw = plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
        return bcrypt.checkpw(pw, hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    """Crea un JWT firmato con subject e scadenza."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.jwt_expire_minutes
    )
    payload: dict[str, Any] = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodifica e valida un JWT. Solleva jose.JWTError se non valido."""
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])

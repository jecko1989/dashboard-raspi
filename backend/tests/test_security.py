"""Test delle utility di sicurezza: hashing password e JWT."""
from __future__ import annotations

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("super-secret")
    assert hashed != "super-secret"  # non in chiaro
    assert verify_password("super-secret", hashed)
    assert not verify_password("wrong", hashed)


def test_jwt_roundtrip() -> None:
    token = create_access_token("admin")
    payload = decode_access_token(token)
    assert payload["sub"] == "admin"
    assert "exp" in payload

"""Test dell'autenticazione della shell web (admin-only)."""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models  # noqa: F401 - registra i modelli su Base.metadata
from app.core.security import create_access_token
from app.db.base import Base
from app.models.user import User
from app.services import shell_service
from app.services.shell_service import ShellAuthError


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


def _add_user(db, username: str, *, is_admin: bool = False, is_active: bool = True) -> User:
    user = User(
        username=username,
        hashed_password="x",
        is_admin=is_admin,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    return user


def test_authenticate_token_requires_token(db) -> None:
    with pytest.raises(ShellAuthError):
        shell_service.authenticate_token(db, None)


def test_authenticate_token_rejects_invalid_token(db) -> None:
    with pytest.raises(ShellAuthError):
        shell_service.authenticate_token(db, "non-e-un-jwt")


def test_authenticate_token_rejects_non_admin(db) -> None:
    _add_user(db, "mario", is_admin=False)
    token = create_access_token("mario")
    with pytest.raises(ShellAuthError):
        shell_service.authenticate_token(db, token)


def test_authenticate_token_rejects_inactive_admin(db) -> None:
    _add_user(db, "spento", is_admin=True, is_active=False)
    token = create_access_token("spento")
    with pytest.raises(ShellAuthError):
        shell_service.authenticate_token(db, token)


def test_authenticate_token_accepts_admin(db) -> None:
    _add_user(db, "admin", is_admin=True)
    token = create_access_token("admin")
    user = shell_service.authenticate_token(db, token)
    assert user.username == "admin"
    assert user.is_admin is True

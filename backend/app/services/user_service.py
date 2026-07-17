"""Servizio utenti: bootstrap admin e autenticazione."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import hash_password, verify_password
from app.models.user import User

logger = get_logger(__name__)


def get_by_username(db: Session, username: str) -> User | None:
    """Ritorna un utente dato lo username, o None."""
    return db.scalar(select(User).where(User.username == username))


def bootstrap_admin(db: Session) -> None:
    """Crea l'utente admin iniziale se non esiste (da ADMIN_USERNAME/PASSWORD)."""
    settings = get_settings()
    if get_by_username(db, settings.admin_username) is not None:
        return
    user = User(
        username=settings.admin_username,
        hashed_password=hash_password(settings.admin_password),
        is_admin=True,
        is_active=True,
    )
    db.add(user)
    db.commit()
    logger.info("Utente admin creato: %s", settings.admin_username)


def authenticate(db: Session, username: str, password: str) -> User | None:
    """Verifica le credenziali. Ritorna l'utente se valide, altrimenti None."""
    user = get_by_username(db, username)
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def change_password(db: Session, user: User, old_password: str, new_password: str) -> bool:
    """Cambia la password dell'utente. Ritorna True se riuscito, False se la vecchia password non è corretta."""
    if not verify_password(old_password, user.hashed_password):
        return False
    user.hashed_password = hash_password(new_password)
    db.commit()
    return True

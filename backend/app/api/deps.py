"""Dependency FastAPI condivise (autenticazione)."""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.services import user_service

# tokenUrl e' usato solo dalla UI Swagger per il pulsante "Authorize".
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=True)

_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Credenziali non valide o token scaduto",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    """Valida il JWT Bearer e ritorna l'utente corrente."""
    try:
        payload = decode_access_token(token)
    except JWTError as exc:
        raise _credentials_exc from exc

    username = payload.get("sub")
    if not username:
        raise _credentials_exc

    user = user_service.get_by_username(db, username)
    if user is None or not user.is_active:
        raise _credentials_exc
    return user

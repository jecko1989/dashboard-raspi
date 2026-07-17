"""Endpoint di autenticazione: login (JWT), logout, utente corrente."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.ratelimit import RateLimiter
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, MessageResponse, TokenResponse, UserRead, ChangePasswordRequest
from app.services import user_service

router = APIRouter(prefix="/auth", tags=["auth"])

# Rate limiting anti brute-force sul login (per client IP).
_login_limiter = RateLimiter(limit=10, window_seconds=60.0)


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest, request: Request, db: Session = Depends(get_db)
) -> TokenResponse:
    key = request.client.host if request.client else "unknown"
    if not _login_limiter.allow(key):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Troppi tentativi di login. Riprova tra poco.",
        )

    user = user_service.authenticate(db, body.username, body.password)
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail="Username o password non validi"
        )
    return TokenResponse(access_token=create_access_token(user.username))


@router.post("/logout", response_model=MessageResponse)
def logout() -> MessageResponse:
    # JWT stateless: il logout e' gestito lato client eliminando il token.
    return MessageResponse(message="ok")


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Cambia la password dell'utente corrente."""
    if not user_service.change_password(db, current_user, body.old_password, body.new_password):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="La vecchia password non è corretta"
        )
    return MessageResponse(message="Password cambiata con successo")

"""Endpoint per la generazione di chiavi SSH per i device.

Azione sensibile: riservata agli utenti admin. Genera una coppia Ed25519 e (se
possibile) salva la privata nel percorso configurato del device; la pubblica va
poi installata sul Raspberry con `ssh-copy-id`.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.logging import get_logger
from app.db.session import get_db
from app.models.user import User
from app.schemas.command import SSHKeyGenerateRequest, SSHKeyResult
from app.services import device_service, ssh_key_service
from app.services.ssh_key_service import SSHKeyError

logger = get_logger(__name__)
router = APIRouter(tags=["ssh-keys"])


@router.post(
    "/devices/{device_id}/ssh-key/generate",
    response_model=SSHKeyResult,
)
def generate_ssh_key(
    device_id: str,
    body: SSHKeyGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Genera una nuova chiave SSH per il device (solo admin)."""
    if not current_user.is_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Operazione riservata agli amministratori",
        )
    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device non trovato")
    if not body.confirm:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Conferma richiesta: impostare confirm=true",
        )
    try:
        result = ssh_key_service.create_device_key(device, force=body.force)
    except SSHKeyError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    logger.info(
        "Generata chiave SSH per device %s (richiesto da %s, saved=%s)",
        device_id,
        current_user.username,
        result["saved"],
    )
    return result

"""Endpoint di comando (azioni con effetti sui dispositivi).

Separati dagli endpoint read-only. Ogni azione:
  - richiede conferma esplicita (`confirm: true`) dal frontend;
  - e' soggetta a rate limiting per client IP;
  - passa attraverso l'allowlist dei comandi;
  - viene registrata in `command_audit_logs`.

I comandi privilegiati assumono una configurazione sudoers NOPASSWD ristretta
sul Raspberry (vedi README). Nessuna password sudo interattiva viene usata.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.ratelimit import RateLimiter
from app.db.session import get_db
from app.models.user import User
from app.schemas.command import CommandRequest, CommandResult, MystRequest, TailscaleAdvertiseRequest
from app.services import command_service, device_service, myst_service
from app.services.command_service import CommandBusyError, CommandError
from app.services.myst_service import MystError

logger = get_logger(__name__)
router = APIRouter(tags=["commands"])

_settings = get_settings()
_limiter = RateLimiter(
    limit=_settings.command_rate_limit_per_minute, window_seconds=60.0
)


def rate_limit(request: Request) -> None:
    """Dependency: rate limiting per client IP sugli endpoint di comando."""
    key = request.client.host if request.client else "unknown"
    if not _limiter.allow(key):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Troppe richieste di comando. Riprova tra poco.",
        )


def _require_device(db: Session, device_id: str):
    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device non trovato")
    return device


def _require_confirm(body: CommandRequest) -> None:
    if not body.confirm:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Conferma richiesta: impostare confirm=true",
        )


def _run(
    db: Session,
    device,
    command_key: str,
    requested_by: str | None,
    service: str | None = None,
) -> CommandResult:
    try:
        return command_service.run_command(
            db, device, command_key, requested_by=requested_by, service=service
        )
    except CommandError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/devices/{device_id}/commands/reboot",
    response_model=CommandResult,
    dependencies=[Depends(rate_limit)],
)
def reboot(
    device_id: str,
    body: CommandRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = _require_device(db, device_id)
    _require_confirm(body)
    return _run(db, device, "reboot", current_user.username)


@router.post(
    "/devices/{device_id}/commands/shutdown",
    response_model=CommandResult,
    dependencies=[Depends(rate_limit)],
)
def shutdown(
    device_id: str,
    body: CommandRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = _require_device(db, device_id)
    _require_confirm(body)
    return _run(db, device, "shutdown", current_user.username)


@router.post(
    "/devices/{device_id}/commands/update",
    response_model=CommandResult,
    dependencies=[Depends(rate_limit)],
)
def update(
    device_id: str,
    body: CommandRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = _require_device(db, device_id)
    _require_confirm(body)
    try:
        return command_service.run_update(
            db, device, dry_run=body.dry_run, requested_by=current_user.username
        )
    except CommandBusyError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except CommandError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/devices/{device_id}/services/{service_name}/restart",
    response_model=CommandResult,
    dependencies=[Depends(rate_limit)],
)
def restart_service(
    device_id: str,
    service_name: str,
    body: CommandRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = _require_device(db, device_id)
    _require_confirm(body)
    return _run(db, device, "service_restart", current_user.username, service=service_name)


@router.post(
    "/devices/{device_id}/commands/tailscale",
    response_model=CommandResult,
    dependencies=[Depends(rate_limit)],
)
def tailscale_advertise(
    device_id: str,
    body: TailscaleAdvertiseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Annuncia exit node e/o subnet route su Tailscale (un singolo comando)."""
    device = _require_device(db, device_id)
    _require_confirm(body)
    try:
        return command_service.run_tailscale_advertise(
            db,
            device,
            exit_node=body.exit_node,
            routes=body.routes,
            requested_by=current_user.username,
        )
    except CommandError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/devices/{device_id}/commands/myst",
    response_model=CommandResult,
    dependencies=[Depends(rate_limit)],
)
def myst_control(
    device_id: str,
    body: MystRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Avvia o arresta il nodo Mysterium (myst) sul device."""
    device = _require_device(db, device_id)
    _require_confirm(body)
    try:
        return command_service.run_myst(db, device, body.action, current_user.username)
    except CommandError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "/devices/{device_id}/myst/backup",
    dependencies=[Depends(rate_limit)],
)
def myst_backup(
    device_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Scarica un backup .zip della data-dir del nodo Mysterium (solo admin)."""
    if not current_user.is_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Operazione riservata agli amministratori"
        )
    device = _require_device(db, device_id)
    try:
        content, filename = myst_service.create_backup(device)
    except MystError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    logger.info("Backup myst scaricato per %s da %s", device_id, current_user.username)
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/devices/{device_id}/myst/restore",
    response_model=CommandResult,
    dependencies=[Depends(rate_limit)],
)
async def myst_restore(
    device_id: str,
    file: UploadFile = File(...),
    confirm: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ripristina un backup .zip del nodo Mysterium sul device (solo admin)."""
    if not current_user.is_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Operazione riservata agli amministratori"
        )
    if not confirm:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Conferma richiesta: impostare confirm=true",
        )
    device = _require_device(db, device_id)
    zip_bytes = await file.read()
    if not zip_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="File vuoto")
    try:
        return myst_service.restore_backup(
            db, device, zip_bytes, requested_by=current_user.username
        )
    except MystError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

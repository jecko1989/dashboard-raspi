"""Endpoint WebSocket della shell web interattiva.

L'autenticazione NON usa l'header Bearer (i WebSocket lato browser non lo
inviano): il JWT arriva in query string (`?token=...`) ed e' validato in
`shell_service.authenticate_token`, che richiede privilegi admin.

La logica di sessione (PTY SSH, ponte I/O, audit, timeout) e' nel service:
la route resta sottile.
"""
from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.services import device_service, shell_service

logger = get_logger(__name__)
router = APIRouter(tags=["shell"])


def _int_param(websocket: WebSocket, name: str, default: int) -> int:
    try:
        return int(websocket.query_params.get(name, default))
    except (TypeError, ValueError):
        return default


@router.websocket("/ws/devices/{device_id}/shell")
async def device_shell(websocket: WebSocket, device_id: str) -> None:
    await websocket.accept()
    db = SessionLocal()
    try:
        token = websocket.query_params.get("token")
        try:
            user = shell_service.authenticate_token(db, token)
        except shell_service.ShellAuthError as exc:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION, reason=str(exc)
            )
            return

        device = device_service.get_device(db, device_id)
        if device is None:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION, reason="Device non trovato"
            )
            return

        cols = _int_param(websocket, "cols", 80)
        rows = _int_param(websocket, "rows", 24)

        try:
            await shell_service.run_session(websocket, device, user, db, cols, rows)
        except shell_service.ShellUnavailableError as exc:
            await websocket.close(
                code=status.WS_1011_INTERNAL_ERROR, reason=str(exc)
            )
            return
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001 - non far cadere il worker
        logger.exception("Errore imprevisto nella shell WebSocket (device=%s)", device_id)
    finally:
        db.close()
        try:
            await websocket.close()
        except Exception:  # noqa: BLE001 - gia' chiuso
            pass

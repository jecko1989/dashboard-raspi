"""Servizio della shell web interattiva (WebSocket <-> SSH PTY).

SICUREZZA — eccezione controllata all'invariante "nessun comando arbitrario":
questa e' l'unica via che consente comandi liberi sul device. Per questo:
  - e' riservata agli utenti admin (verifica del token JWT lato WebSocket);
  - e' disattivabile globalmente (`shell_enabled`);
  - e' soggetta a rate limit per utente e a un numero massimo di sessioni;
  - ogni apertura/chiusura viene registrata in `command_audit_logs` e in `events`;
  - la sessione ha un timeout massimo e un timeout di inattivita'.

Le chiamate Paramiko sono bloccanti: vengono eseguite fuori dall'event loop
tramite `run_in_executor`/`to_thread` per non bloccare FastAPI.
"""
from __future__ import annotations

import asyncio
import json
import socket
import threading
import time

from fastapi import WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.ratelimit import RateLimiter
from app.core.security import decode_access_token
from app.models.command_audit_log import CommandAuditLog
from app.models.device import Device
from app.models.event import Event
from app.models.user import User
from app.services import user_service
from app.ssh.client import SSHClient, SSHError, SSHTarget

logger = get_logger(__name__)

_settings = get_settings()
_MAX_DETAIL = 2000
_RECV_CHUNK = 4096
_RECV_TIMEOUT = 0.2  # secondi: consente al reader di verificare la chiusura

_limiter = RateLimiter(
    limit=_settings.shell_rate_limit_per_minute, window_seconds=60.0
)

# Contatore delle sessioni attive per limitare la concorrenza (per processo).
_sessions_lock = threading.Lock()
_active_sessions = 0


class ShellError(Exception):
    """Errore generico della shell web."""


class ShellAuthError(ShellError):
    """Autenticazione/autorizzazione WebSocket fallita."""


class ShellUnavailableError(ShellError):
    """Shell non disponibile (disabilitata, limiti, o device non raggiungibile)."""


def _target(device: Device) -> SSHTarget:
    return SSHTarget(
        host=device.ip_vpn,
        port=device.ssh_port,
        username=device.ssh_username,
        key_path=device.ssh_key_path,
    )


def authenticate_token(db: Session, token: str | None) -> User:
    """Valida il JWT passato in query string e richiede privilegi admin."""
    if not token:
        raise ShellAuthError("Token mancante")
    try:
        payload = decode_access_token(token)
    except JWTError as exc:
        raise ShellAuthError("Token non valido o scaduto") from exc

    username = payload.get("sub")
    if not username:
        raise ShellAuthError("Token non valido")

    user = user_service.get_by_username(db, username)
    if user is None or not user.is_active:
        raise ShellAuthError("Utente non valido")
    if not user.is_admin:
        raise ShellAuthError("Permessi insufficienti: richiesto admin")
    return user


def _acquire_slot() -> bool:
    global _active_sessions
    with _sessions_lock:
        if _active_sessions >= _settings.shell_max_sessions:
            return False
        _active_sessions += 1
        return True


def _release_slot() -> None:
    global _active_sessions
    with _sessions_lock:
        if _active_sessions > 0:
            _active_sessions -= 1


def _audit(
    db: Session,
    device: Device,
    status: str,
    requested_by: str | None,
    detail: str | None = None,
) -> CommandAuditLog:
    entry = CommandAuditLog(
        device_id=device.id,
        command="shell",
        target=None,
        status=status,
        detail=(detail or "")[:_MAX_DETAIL] or None,
        requested_by=requested_by,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def _recv(channel) -> bytes | None:
    """Legge dal canale SSH. Ritorna None se il canale e' chiuso (EOF)."""
    channel.settimeout(_RECV_TIMEOUT)
    try:
        data = channel.recv(_RECV_CHUNK)
        if not data:
            return None  # EOF: sessione remota terminata
        return data
    except socket.timeout:
        return b""
    except Exception:  # noqa: BLE001 - canale non piu' utilizzabile
        return None


def _handle_client_message(channel, raw: str) -> None:
    """Interpreta un messaggio JSON dal client (input o resize)."""
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError):
        return
    if not isinstance(payload, dict):
        return

    mtype = payload.get("type")
    if mtype == "input":
        data = payload.get("data", "")
        if isinstance(data, str) and data:
            channel.send(data.encode("utf-8", errors="ignore"))
    elif mtype == "resize":
        try:
            cols = max(1, min(int(payload.get("cols", 80)), 500))
            rows = max(1, min(int(payload.get("rows", 24)), 300))
            channel.resize_pty(width=cols, height=rows)
        except Exception:  # noqa: BLE001 - resize best effort
            pass


async def _bridge(websocket: WebSocket, channel) -> str:
    """Ponte bidirezionale WS<->SSH. Ritorna il motivo di chiusura."""
    stop = asyncio.Event()
    last_activity = [time.monotonic()]
    reason = ["sessione terminata"]

    async def ssh_to_ws() -> None:
        loop = asyncio.get_running_loop()
        try:
            while not stop.is_set():
                data = await loop.run_in_executor(None, _recv, channel)
                if data is None:
                    reason[0] = "sessione remota terminata"
                    return
                if data:
                    last_activity[0] = time.monotonic()
                    await websocket.send_bytes(data)
        finally:
            stop.set()

    async def ws_to_ssh() -> None:
        try:
            while not stop.is_set():
                raw = await websocket.receive_text()
                last_activity[0] = time.monotonic()
                _handle_client_message(channel, raw)
        finally:
            stop.set()

    async def watchdog() -> None:
        start = time.monotonic()
        try:
            while not stop.is_set():
                await asyncio.sleep(1.0)
                now = time.monotonic()
                if now - start > _settings.shell_session_timeout_seconds:
                    reason[0] = "durata massima sessione raggiunta"
                    return
                if now - last_activity[0] > _settings.shell_idle_timeout_seconds:
                    reason[0] = "sessione chiusa per inattivita'"
                    return
        finally:
            stop.set()

    tasks = [
        asyncio.create_task(ssh_to_ws()),
        asyncio.create_task(ws_to_ssh()),
        asyncio.create_task(watchdog()),
    ]
    try:
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        stop.set()
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    # Propaga la disconnessione del client o altri errori reali.
    for task in tasks:
        if task.cancelled():
            continue
        exc = task.exception()
        if isinstance(exc, WebSocketDisconnect):
            raise exc
        if exc is not None:
            raise exc
    return reason[0]


async def run_session(
    websocket: WebSocket,
    device: Device,
    user: User,
    db: Session,
    cols: int = 80,
    rows: int = 24,
) -> None:
    """Apre la shell SSH e ponte con il WebSocket, con audit e limiti."""
    if not _settings.shell_enabled:
        raise ShellUnavailableError("Shell web disabilitata")
    if not _limiter.allow(user.username):
        raise ShellUnavailableError("Troppe aperture shell. Riprova tra poco.")
    if not _acquire_slot():
        raise ShellUnavailableError("Numero massimo di sessioni shell raggiunto")

    entry = _audit(
        db, device, "pending", user.username, detail=f"cols={cols},rows={rows}"
    )
    db.add(
        Event(
            device_id=device.id,
            type="shell",
            message=f"Shell web aperta da {user.username}",
        )
    )
    db.commit()

    ssh = SSHClient(_target(device))
    client = None
    channel = None
    try:
        client, channel = await asyncio.to_thread(
            ssh.open_shell, "xterm-256color", cols, rows
        )
    except SSHError as exc:
        _release_slot()
        entry.status = "error"
        entry.detail = str(exc)[:_MAX_DETAIL]
        db.commit()
        raise ShellUnavailableError(str(exc)) from exc

    status = "success"
    detail = "sessione terminata"
    try:
        detail = await _bridge(websocket, channel)
    except WebSocketDisconnect:
        detail = "client disconnesso"
    except Exception as exc:  # noqa: BLE001 - registrato in audit
        status = "error"
        detail = f"errore: {exc}"
        logger.warning("Errore nella sessione shell su %s: %s", device.id, exc)
    finally:
        SSHClient.close_shell(client, channel)
        _release_slot()
        entry.status = status
        entry.detail = (detail or "")[:_MAX_DETAIL] or None
        db.add(
            Event(
                device_id=device.id,
                type="shell",
                message=f"Shell web chiusa ({status}) - {user.username}",
            )
        )
        db.commit()

"""Servizio di esecuzione dei comandi remoti privilegiati.

Ogni esecuzione:
  - passa SEMPRE attraverso l'allowlist (nessun comando arbitrario);
  - viene registrata in un audit log (pending -> success/error);
  - usa esclusivamente SSH a chiave.

I comandi privilegiati assumono una configurazione sudoers NOPASSWD ristretta
sul Raspberry (vedi README). Nessuna password sudo interattiva viene usata.
"""
from __future__ import annotations

import threading

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.command_audit_log import CommandAuditLog
from app.models.device import Device
from app.models.event import Event
from app.schemas.command import CommandResult
from app.ssh import allowlist
from app.ssh.client import SSHClient, SSHError, SSHResult, SSHTarget

logger = get_logger(__name__)

# Comandi per cui la disconnessione durante l'esecuzione e' attesa (il device
# si spegne o riavvia): non va trattata come errore.
_DISCONNECTING = {"reboot", "shutdown"}

# Limite di lunghezza del dettaglio salvato in audit/log.
_MAX_DETAIL = 2000

# Lock in-process per prevenire aggiornamenti apt concorrenti sullo stesso
# device (es. doppio click sul bottone "Aggiorna"): due 'apt-get' insieme si
# bloccano a vicenda sul lock di dpkg. Valido per il singolo worker del processo.
_apt_lock_guard = threading.Lock()
_apt_running_devices: set[str] = set()


class CommandError(Exception):
    """Comando non consentito o input non valido."""


class CommandBusyError(CommandError):
    """Un'operazione dello stesso tipo e' gia' in corso sul device."""


def _target(device: Device) -> SSHTarget:
    return SSHTarget(
        host=device.ip_vpn,
        port=device.ssh_port,
        username=device.ssh_username,
        key_path=device.ssh_key_path,
    )


def _build_command(
    command_key: str,
    service: str | None,
    subnet: str | None = None,
    pwm: int | None = None,
) -> str:
    """Costruisce la stringa di comando dall'allowlist, validando gli argomenti."""
    if command_key not in allowlist.PRIVILEGED_COMMANDS:
        raise CommandError(f"Comando non consentito: {command_key}")

    template = allowlist.PRIVILEGED_COMMANDS[command_key]
    if "{service}" in template:
        if not service or not allowlist.is_valid_service_name(service):
            raise CommandError("Nome servizio non valido")
        return template.format(service=service)
    if "{subnet}" in template:
        if not subnet or not allowlist.is_valid_cidr(subnet):
            raise CommandError("Subnet (CIDR) non valida")
        return template.format(subnet=subnet)
    if "{pwm}" in template:
        if pwm is None or not allowlist.is_valid_pwm_value(pwm):
            raise CommandError("Valore PWM non valido")
        return template.format(pwm=pwm)
    return template


def _parse_default_iface(output: str) -> str | None:
    """Estrae l'interfaccia della route di default (es. 'eth0')."""
    for line in output.splitlines():
        parts = line.split()
        if "dev" in parts:
            idx = parts.index("dev")
            if idx + 1 < len(parts):
                return parts[idx + 1]
    return None


def _parse_lan_subnet(output: str, iface: str | None) -> str | None:
    """Estrae la subnet CIDR della LAN, scartando interfacce virtuali."""
    skip = ("docker", "veth", "br-", "tailscale", "lo")
    candidates: list[tuple[str, str]] = []
    for line in output.splitlines():
        parts = line.split()
        if not parts or "dev" not in parts:
            continue
        cidr = parts[0]
        dev = parts[parts.index("dev") + 1]
        if any(dev.startswith(s) for s in skip):
            continue
        candidates.append((dev, cidr))
    # Preferisci l'interfaccia della route di default.
    for dev, cidr in candidates:
        if iface and dev == iface:
            return cidr
    return candidates[0][1] if candidates else None


def _detect_lan_subnet(device: Device) -> str:
    """Rileva sul device la subnet LAN da annunciare come route Tailscale."""
    client = SSHClient(_target(device))
    try:
        iface_res = client.run(allowlist.READONLY_COMMANDS["default_iface"])
        routes_res = client.run(allowlist.READONLY_COMMANDS["lan_routes"])
    except SSHError as exc:
        raise CommandError(f"Impossibile contattare il device: {exc}") from exc
    iface = _parse_default_iface(iface_res.stdout)
    subnet = _parse_lan_subnet(routes_res.stdout, iface)
    if not subnet or not allowlist.is_valid_cidr(subnet):
        raise CommandError("Impossibile determinare la subnet LAN del device")
    return subnet


def _audit(
    db: Session,
    device: Device,
    command: str,
    status: str,
    requested_by: str | None,
    target: str | None = None,
    detail: str | None = None,
) -> CommandAuditLog:
    entry = CommandAuditLog(
        device_id=device.id,
        command=command,
        target=target,
        status=status,
        detail=(detail or "")[:_MAX_DETAIL] or None,
        requested_by=requested_by,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def run_command(
    db: Session,
    device: Device,
    command_key: str,
    requested_by: str | None = None,
    service: str | None = None,
    subnet: str | None = None,
    pwm: int | None = None,
) -> CommandResult:
    """Esegue un comando privilegiato sul device, con audit completo."""
    audit_target = service or subnet or (str(pwm) if pwm is not None else None)
    try:
        command_str = _build_command(command_key, service, subnet, pwm)
    except CommandError as exc:
        _audit(
            db, device, command_key, "denied", requested_by, target=audit_target, detail=str(exc)
        )
        raise

    # Audit iniziale: tentativo registrato prima dell'esecuzione.
    entry = _audit(db, device, command_key, "pending", requested_by, target=audit_target)
    logger.info(
        "Esecuzione comando '%s' su %s (richiesto da %s)",
        command_key,
        device.id,
        requested_by or "n/d",
    )

    result_status = "error"
    detail = None
    try:
        result: SSHResult = SSHClient(_target(device)).run(command_str)
        if result.ok:
            result_status = "success"
            detail = result.stdout.strip() or "ok"
        else:
            detail = (result.stderr or result.stdout).strip() or f"exit={result.exit_code}"
    except SSHError as exc:
        if command_key in _DISCONNECTING:
            # Disconnessione attesa: il comando e' stato inviato.
            result_status = "success"
            detail = "Comando inviato; connessione terminata (atteso)."
        else:
            detail = str(exc)

    # Aggiorna l'audit con l'esito.
    entry.status = result_status
    entry.detail = (detail or "")[:_MAX_DETAIL] or None
    db.add(Event(device_id=device.id, type="command", message=f"{command_key}: {result_status}"))
    db.commit()

    return CommandResult(
        device_id=device.id,
        command=command_key,
        status=result_status,
        detail=detail,
    )


def _acquire_apt_lock(device_id: str) -> None:
    """Riserva l'esecuzione apt per il device; se occupato solleva CommandBusyError."""
    with _apt_lock_guard:
        if device_id in _apt_running_devices:
            raise CommandBusyError(
                "Un aggiornamento pacchetti è già in corso su questo device. "
                "Attendi il completamento prima di rilanciarlo."
            )
        _apt_running_devices.add(device_id)


def _release_apt_lock(device_id: str) -> None:
    with _apt_lock_guard:
        _apt_running_devices.discard(device_id)


def is_apt_running(device_id: str) -> bool:
    """True se un aggiornamento apt e' in corso sul device (in questo processo)."""
    with _apt_lock_guard:
        return device_id in _apt_running_devices


def run_update(
    db: Session,
    device: Device,
    *,
    dry_run: bool,
    requested_by: str | None = None,
) -> CommandResult:
    """Esegue l'aggiornamento pacchetti (check + upgrade) o la sola simulazione.

    Un lock per-device impedisce due 'apt-get' concorrenti sullo stesso device,
    che si bloccherebbero a vicenda sul lock di dpkg.
    """
    if dry_run:
        # La simulazione (apt-get -s upgrade) non acquisisce il lock di dpkg.
        return run_command(db, device, "update_dry_run", requested_by=requested_by)

    _acquire_apt_lock(device.id)
    try:
        check = run_command(db, device, "update_check", requested_by=requested_by)
        if check.status != "success":
            return check
        return run_command(db, device, "update_upgrade", requested_by=requested_by)
    finally:
        _release_apt_lock(device.id)


def run_tailscale_advertise(
    db: Session,
    device: Device,
    *,
    exit_node: bool,
    routes: bool,
    requested_by: str | None = None,
) -> CommandResult:
    """Annuncia su Tailscale exit node e/o subnet route (un solo comando).

    La subnet viene rilevata automaticamente sul device; l'exit node non
    richiede argomenti. Almeno una delle due opzioni deve essere True.
    """
    if not exit_node and not routes:
        raise CommandError("Selezionare almeno un'opzione (exit node e/o routes)")

    if routes:
        subnet = _detect_lan_subnet(device)
        command_key = "tailscale_exit_and_routes" if exit_node else "tailscale_routes"
        return run_command(
            db, device, command_key, requested_by=requested_by, subnet=subnet
        )
    return run_command(db, device, "tailscale_exit_node", requested_by=requested_by)


def run_myst(
    db: Session, device: Device, action: str, requested_by: str | None = None
) -> CommandResult:
    """Avvia o arresta il nodo Mysterium (myst) sul device."""
    if action not in ("start", "stop"):
        raise CommandError("Azione myst non valida (start|stop)")
    return run_command(db, device, f"myst_{action}", requested_by=requested_by)


def run_fan_control(
    db: Session,
    device: Device,
    *,
    mode: str,
    rpm: int | None,
    requested_by: str | None = None,
) -> CommandResult:
    """Imposta la modalita' ventola su PWM automatico o fixed con target RPM.

    Il kernel espone in sysfs il duty-cycle PWM (0..255), non RPM assoluti.
    In modalita' fixed, il target RPM viene convertito in un duty-cycle stimato.
    """
    if mode not in {"pwm", "fixed"}:
        raise CommandError("Modalita' ventola non valida (pwm|fixed)")

    if mode == "pwm":
        return run_command(db, device, "fan_mode_pwm", requested_by=requested_by)

    if rpm is None:
        raise CommandError("Per la modalita' fixed e' obbligatorio specificare rpm")

    # Conversione semplice target RPM -> duty-cycle PWM su range pratico.
    min_rpm = 300
    max_rpm = 9000
    bounded = max(min_rpm, min(max_rpm, rpm))
    pwm = round((bounded - min_rpm) / (max_rpm - min_rpm) * 255)
    pwm = max(0, min(255, pwm))

    return run_command(
        db,
        device,
        "fan_mode_fixed",
        requested_by=requested_by,
        pwm=pwm,
    )


def run_readonly(
    db: Session, device: Device, command_key: str, service: str | None = None
) -> SSHResult:
    """Esegue un comando read-only dell'allowlist (status/log servizi).

    Non registra audit (nessun effetto sul device). Solleva SSHError se la
    connessione fallisce.
    """
    if command_key in allowlist.READONLY_COMMANDS:
        template = allowlist.READONLY_COMMANDS[command_key]
    elif command_key in allowlist.PRIVILEGED_COMMANDS:
        template = allowlist.PRIVILEGED_COMMANDS[command_key]
    else:
        raise CommandError(f"Comando non consentito: {command_key}")
    if service is not None:
        if not allowlist.is_valid_service_name(service):
            raise CommandError("Nome servizio non valido")
        command_str = template.format(service=service)
    else:
        command_str = template
    return SSHClient(_target(device)).run(command_str)

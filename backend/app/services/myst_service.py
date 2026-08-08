"""Backup e ripristino del nodo Mysterium (installazione nativa o container Docker).

La data-dir del nodo (`/var/lib/mysterium-node`) contiene l'identità in
`keystore/` (file `UTC*`), i DB e `nodeui-pass`. Il backup viene prodotto sul
device con `tar -czf -` (via SSH, come root) e incapsulato in un file **.zip**
scaricabile dal browser. Lo zip contiene il `.tar.gz` originale, così i permessi
e l'ownership Unix sono preservati per un ripristino pulito.

Il nodo puo' essere nativo (systemd) o containerizzato (Docker) a seconda del
device: il flag `DeviceConfig.myst_docker` (config/devices.yaml) determina quale
variante dei comandi myst_start/myst_stop/myst_restart viene eseguita
(risolta in `command_service._resolve_myst_command_key`). Se il nodo gira in
Docker, la data-dir e' la stessa in bind-mount nel container (stesso path host
e container), quindi il flusso di backup/restore qui sotto non cambia.

Ripristino: si ferma il servizio/container, si estrae il tar nella data-dir, si
ripristina l'ownership e si riavvia. Dopo il ripristino il nodo va **ri-rivendicato**
su mystnodes.com.
"""
from __future__ import annotations

import io
import zipfile
from datetime import datetime, timezone

from app.core.logging import get_logger
from app.models.device import Device
from app.schemas.command import CommandResult
from app.services import command_service
from app.ssh import allowlist
from app.ssh.client import SSHClient, SSHError, SSHTarget

logger = get_logger(__name__)

# Nome dell'archivio tar.gz incapsulato dentro lo zip di backup.
TARGZ_ENTRY = "mysterium-node-data.tar.gz"


class MystError(Exception):
    """Errore durante backup o ripristino del nodo Mysterium."""


def _target(device: Device) -> SSHTarget:
    return SSHTarget(
        host=device.ip_vpn,
        port=device.ssh_port,
        username=device.ssh_username,
        key_path=device.ssh_key_path,
    )


def _readme() -> str:
    return (
        "Backup del nodo Mysterium (data-dir /var/lib/mysterium-node).\n\n"
        f"Contiene l'archivio '{TARGZ_ENTRY}' con keystore/ (identita' del nodo),\n"
        "i database e nodeui-pass, con permessi Unix preservati.\n\n"
        "RIPRISTINO consigliato: usa il pulsante 'Ripristina backup' nella\n"
        "dashboard sullo stesso device (o su un Raspberry appena reinstallato con\n"
        "il nodo myst gia' installato, nativo o in Docker).\n\n"
        "Ripristino manuale (in alternativa), sul Raspberry:\n"
        "  # installazione nativa (systemd):\n"
        "  sudo systemctl stop mysterium-node\n"
        f"  # estrai '{TARGZ_ENTRY}' dentro /var/lib/mysterium-node\n"
        "  sudo tar -xzf mysterium-node-data.tar.gz -C /var/lib/mysterium-node\n"
        "  sudo chown -R mysterium-node /var/lib/mysterium-node\n"
        "  sudo systemctl restart mysterium-node\n\n"
        "  # installazione Docker (container 'myst'):\n"
        "  sudo docker stop myst\n"
        f"  # estrai '{TARGZ_ENTRY}' dentro /var/lib/mysterium-node (stesso path, bind-mount)\n"
        "  sudo tar -xzf mysterium-node-data.tar.gz -C /var/lib/mysterium-node\n"
        "  sudo docker start myst\n\n"
        "Dopo il ripristino, per riscattare il nodo apri i settings locali:\n"
        "  http://<ip_lan>:4449#settings\n"
    )


def create_backup(device: Device) -> tuple[bytes, str]:
    """Crea un backup .zip della data-dir del nodo. Ritorna (bytes_zip, filename)."""
    try:
        # tar esce con exit=1 se un file (es. i log del nodo attivo) cambia durante
        # la lettura: e' solo un warning, l'archivio prodotto e' comunque valido e
        # completo per l'identita' in keystore/. Lo tolleriamo per evitare downtime
        # (nessun bisogno di fermare il nodo per il backup).
        targz = SSHClient(_target(device)).run_binary(
            allowlist.PRIVILEGED_COMMANDS["myst_backup"],
            allow_exit_codes=(0, 1),
        )
    except SSHError as exc:
        raise MystError(f"Backup fallito: {exc}") from exc
    if not targz:
        raise MystError(
            "Backup vuoto: la data-dir /var/lib/mysterium-node potrebbe non esistere "
            "(myst installato?)."
        )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(TARGZ_ENTRY, targz)
        zf.writestr("README.txt", _readme())
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"myst-backup-{device.id}-{ts}.zip"
    logger.info("Backup myst creato per %s (%d byte)", device.id, len(targz))
    return buf.getvalue(), filename


def restore_backup(
    db, device: Device, zip_bytes: bytes, requested_by: str | None = None
) -> CommandResult:
    """Ripristina un backup .zip sul device: stop → estrai → chown → restart."""
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            if TARGZ_ENTRY not in zf.namelist():
                raise MystError(
                    f"Backup non valido: manca '{TARGZ_ENTRY}'. "
                    "Usa un file generato dal pulsante di backup."
                )
            targz = zf.read(TARGZ_ENTRY)
    except zipfile.BadZipFile as exc:
        raise MystError("Il file caricato non è uno zip valido.") from exc

    # 1. Ferma il servizio (audited).
    command_service.run_command(db, device, "myst_stop", requested_by=requested_by)

    # 2. Estrae il tar nella data-dir (stream binario su stdin).
    try:
        res = SSHClient(_target(device)).run_with_input(
            allowlist.PRIVILEGED_COMMANDS["myst_restore"], targz
        )
    except SSHError as exc:
        command_service.run_command(db, device, "myst_start", requested_by=requested_by)
        raise MystError(f"Estrazione fallita: {exc}") from exc
    if not res.ok:
        command_service.run_command(db, device, "myst_start", requested_by=requested_by)
        raise MystError(f"Estrazione fallita: {(res.stderr or res.stdout).strip()}")

    # 3. Ripristina l'ownership e 4. riavvia (entrambi audited).
    command_service.run_command(db, device, "myst_chown", requested_by=requested_by)
    restart = command_service.run_command(
        db, device, "myst_restart", requested_by=requested_by
    )

    detail = (
        "Backup ripristinato e servizio riavviato. "
        "Per riscattare il nodo accedi ai settings locali: "
        "http://<ip_lan>:4449#settings"
        if restart.status == "success"
        else f"Estrazione ok, ma il riavvio del servizio ha restituito: {restart.detail}"
    )
    return CommandResult(
        device_id=device.id,
        command="myst_restore",
        status=restart.status,
        detail=detail,
    )


def is_docker(device_id: str) -> bool:
    """Ritorna True se il nodo myst del device e' containerizzato (Docker)."""
    from app.services.config_loader import get_device_config, load_devices_config

    config = load_devices_config()
    dev_cfg = get_device_config(config, device_id)
    return bool(dev_cfg and dev_cfg.myst_docker)


def update_docker_node(
    db, device: Device, requested_by: str | None = None
) -> CommandResult:
    """Aggiorna il nodo myst containerizzato: pull immagine, ricrea il container.

    Solo per device con `myst_docker: true` in config. Riusa la stessa data-dir
    in bind-mount, quindi identita' e guadagni del nodo restano invariati.
    """
    from app.services.config_loader import get_device_config, load_devices_config

    config = load_devices_config()
    dev_cfg = get_device_config(config, device.id)
    if not dev_cfg or not dev_cfg.myst_docker:
        raise MystError(
            "Il nodo myst su questo device non è containerizzato (Docker): "
            "l'aggiornamento immagine non è applicabile."
        )

    # 1. Scarica la nuova immagine (non tocca il container in esecuzione: se
    # fallisce, il nodo continua a funzionare con l'immagine attuale).
    pull = command_service.run_command(db, device, "myst_docker_pull", requested_by=requested_by)
    if pull.status != "success":
        return CommandResult(
            device_id=device.id,
            command="myst_docker_update",
            status="error",
            detail=f"Pull immagine fallito, nodo non toccato: {pull.detail}",
        )

    # 2. Rimuove il container corrente (la data-dir è in bind-mount, non persa).
    command_service.run_command(db, device, "myst_docker_stop_rm", requested_by=requested_by)

    # 3. Ricrea il container dalla nuova immagine con gli stessi parametri.
    recreate = command_service.run_command(
        db,
        device,
        "myst_docker_recreate",
        requested_by=requested_by,
        udp_start=dev_cfg.myst_docker_udp_start,
        udp_end=dev_cfg.myst_docker_udp_end,
    )
    detail = (
        "Nodo aggiornato: immagine scaricata e container ricreato con la stessa identità."
        if recreate.status == "success"
        else f"Pull e rimozione ok, ma la ricreazione del container ha restituito: {recreate.detail}"
    )
    return CommandResult(
        device_id=device.id,
        command="myst_docker_update",
        status=recreate.status,
        detail=detail,
    )

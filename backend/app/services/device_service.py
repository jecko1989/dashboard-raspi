"""Servizio di sincronizzazione config -> database e query sui device.

Sincronizza luoghi e device dal file YAML al DB, fornisce funzioni di lettura
e le operazioni CRUD (creazione/modifica/eliminazione) di luoghi e device.
"""
from __future__ import annotations

import ipaddress
import re

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.alert import Alert
from app.models.command_audit_log import CommandAuditLog
from app.models.device import Device
from app.models.event import Event
from app.models.luogo import Luogo
from app.models.metric import Metric
from app.services import config_loader
from app.services.config_loader import DevicesConfig, load_devices_config

logger = get_logger(__name__)

# --- Validazione input creazione device --------------------------------------

# Id logico: minuscole/numeri, separatori '-' e '_', inizia con alfanumerico.
_DEVICE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
# Hostname RFC-1123 (label separate da punto, senza trattini iniziali/finali).
_HOSTNAME_RE = re.compile(
    r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)"
    r"(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$"
)
# Utente SSH POSIX.
_SSH_USER_RE = re.compile(r"^[a-z_][a-z0-9_-]{0,31}$")


class DeviceCreateError(Exception):
    """Errore base nella creazione di un device."""


class InvalidDeviceData(DeviceCreateError):
    """Dati del device non validi (formato)."""


class LuogoNotFound(DeviceCreateError):
    """Luogo indicato inesistente."""


class DeviceNotFound(DeviceCreateError):
    """Device indicato inesistente."""


class LuogoError(Exception):
    """Errore base nelle operazioni sui luoghi."""


class InvalidLuogoData(LuogoError):
    """Dati del luogo non validi (formato)."""


class DuplicateLuogo(LuogoError):
    """Luogo duplicato (id gia' in uso)."""


class LuogoNotEmpty(LuogoError):
    """Il luogo contiene ancora dei device e non puo' essere eliminato."""


class DuplicateDevice(DeviceCreateError):
    """Device duplicato (id, hostname o indirizzo)."""

    def __init__(self, field: str, value: str) -> None:
        self.field = field
        self.value = value
        super().__init__(f"{field} gia' in uso: {value}")


def is_valid_device_id(value: str) -> bool:
    """Valida l'id logico di un device."""
    return bool(_DEVICE_ID_RE.fullmatch(value))


def is_valid_hostname(value: str) -> bool:
    """Valida un hostname (label RFC-1123)."""
    return bool(_HOSTNAME_RE.fullmatch(value))


def is_valid_ip_vpn(value: str) -> bool:
    """Valida l'indirizzo VPN: IPv4, IPv6 oppure nome host/MagicDNS."""
    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        return is_valid_hostname(value)


def is_valid_ssh_username(value: str) -> bool:
    """Valida un username SSH POSIX."""
    return bool(_SSH_USER_RE.fullmatch(value))


def is_valid_luogo_id(value: str) -> bool:
    """Valida l'id logico di un luogo (stessa forma dell'id device)."""
    return bool(_DEVICE_ID_RE.fullmatch(value))


def sync_config_to_db(db: Session, config: DevicesConfig | None = None) -> None:
    """Crea/aggiorna luoghi e device nel DB a partire dalla config YAML.

    Rimuove anche i luoghi/device non piu' presenti nella config
    (es. dopo un rename dell'id), insieme alle righe dipendenti dei device.
    """
    config = config or load_devices_config()

    for lg in config.luoghi:
        luogo = db.get(Luogo, lg.id)
        if luogo is None:
            luogo = Luogo(id=lg.id, name=lg.name)
            db.add(luogo)
        else:
            luogo.name = lg.name
        luogo.display_order = lg.order

        for dev in lg.devices:
            device = db.get(Device, dev.id)
            if device is None:
                device = Device(id=dev.id)
                db.add(device)
            device.name = dev.name
            device.hostname = dev.hostname
            device.ip_vpn = dev.ip_vpn
            device.description = dev.description
            device.tags = list(dev.tags)
            device.luogo_id = lg.id
            device.ssh_username = dev.ssh.username
            device.ssh_port = dev.ssh.port
            device.ssh_key_path = dev.ssh.key_path
            device.display_order = dev.order

    _prune_removed(db, config)

    db.commit()
    logger.info("Sincronizzazione config -> DB completata.")


def _prune_removed(db: Session, config: DevicesConfig) -> None:
    """Elimina luoghi/device non piu' presenti nella config."""
    config_luogo_ids = {lg.id for lg in config.luoghi}
    config_dev_ids = {dev.id for lg in config.luoghi for dev in lg.devices}

    # Device rimossi: elimina prima le righe dipendenti (nessuna FK cascade).
    for device in list(db.scalars(select(Device)).all()):
        if device.id not in config_dev_ids:
            for model in (Metric, Alert, Event, CommandAuditLog):
                db.execute(delete(model).where(model.device_id == device.id))
            db.delete(device)
            logger.info("Rimosso device non piu' in config: %s", device.id)

    # Luoghi rimossi (ormai senza device di config).
    for luogo in list(db.scalars(select(Luogo)).all()):
        if luogo.id not in config_luogo_ids:
            db.delete(luogo)
            logger.info("Rimosso luogo non piu' in config: %s", luogo.id)


def get_luoghi(db: Session) -> list[Luogo]:
    """Ritorna i luoghi ordinati per display_order, poi per nome."""
    return list(
        db.scalars(
            select(Luogo).order_by(Luogo.display_order, Luogo.name)
        ).all()
    )


def get_devices(db: Session, luogo_id: str | None = None) -> list[Device]:
    """Ritorna i device (opz. per luogo), ordinati per display_order, poi nome."""
    stmt = select(Device)
    if luogo_id:
        stmt = stmt.where(Device.luogo_id == luogo_id)
    stmt = stmt.order_by(Device.display_order, Device.name)
    return list(db.scalars(stmt).all())


def get_device(db: Session, device_id: str) -> Device | None:
    """Ritorna un singolo device per id."""
    return db.get(Device, device_id)


def build_ssh_command(device: Device) -> str:
    """Costruisce il comando SSH pronto da copiare per un device."""
    return (
        f"ssh -i {device.ssh_key_path} -p {device.ssh_port} "
        f"{device.ssh_username}@{device.ip_vpn}"
    )


def create_device(db: Session, payload) -> Device:
    """Crea un nuovo device: valida, scrive nella config YAML e sincronizza il DB.

    La config `devices.yaml` resta la fonte di verita' (config-driven): scrive li'
    il device e poi riallinea il DB con `sync_config_to_db`. I campi runtime
    (online, latenza, ultima verifica) NON sono impostabili qui: restano gestiti
    dai processi di monitoraggio.

    Solleva:
      - InvalidDeviceData: formato non valido;
      - LuogoNotFound: luogo inesistente;
      - DuplicateDevice: id/hostname/indirizzo gia' in uso.
    """
    # Normalizzazione (trim degli spazi iniziali/finali).
    dev_id = (payload.id or "").strip()
    name = (payload.name or "").strip()
    hostname = (payload.hostname or "").strip()
    ip_vpn = (payload.ip_vpn or "").strip()
    luogo_id = (payload.luogo_id or "").strip()
    ssh_username = (payload.ssh_username or "").strip()
    ssh_port = payload.ssh_port
    description = (payload.description or "").strip() or None
    tags = [t.strip() for t in (payload.tags or []) if t and t.strip()]

    # Validazione di formato.
    if not is_valid_device_id(dev_id):
        raise InvalidDeviceData(
            "Identificativo non valido: usa minuscole, numeri, '-' o '_' "
            "(1-64 caratteri, inizio alfanumerico)."
        )
    if not name:
        raise InvalidDeviceData("Il nome visualizzato e' obbligatorio.")
    if not is_valid_hostname(hostname):
        raise InvalidDeviceData("Hostname non valido.")
    if not is_valid_ip_vpn(ip_vpn):
        raise InvalidDeviceData(
            "Indirizzo VPN/Tailscale non valido: usa un IPv4, un IPv6 "
            "oppure un nome host/MagicDNS."
        )
    if not is_valid_ssh_username(ssh_username):
        raise InvalidDeviceData("Utente SSH non valido.")
    if not (1 <= ssh_port <= 65535):
        raise InvalidDeviceData("Porta SSH non valida (1-65535).")

    config = load_devices_config()

    # Luogo esistente?
    if not any(lg.id == luogo_id for lg in config.luoghi):
        raise LuogoNotFound(luogo_id)

    # Duplicati: controlla sia la config sia il DB.
    existing_ids = {d.id for lg in config.luoghi for d in lg.devices}
    if dev_id in existing_ids or db.get(Device, dev_id) is not None:
        raise DuplicateDevice("id", dev_id)

    existing_hostnames = {
        d.hostname.strip().lower() for lg in config.luoghi for d in lg.devices
    }
    if hostname.lower() in existing_hostnames:
        raise DuplicateDevice("hostname", hostname)

    existing_ips = {
        d.ip_vpn.strip().lower() for lg in config.luoghi for d in lg.devices
    }
    if ip_vpn.lower() in existing_ips:
        raise DuplicateDevice("ip_vpn", ip_vpn)

    # Path chiave SSH generato (variabile NON espansa: portabile tra ambienti).
    key_suffix = dev_id.replace("-", "_")
    key_path = f"${{SSH_KEYS_DIR}}/id_{key_suffix}"

    device_yaml: dict = {
        "id": dev_id,
        "name": name,
        "hostname": hostname,
        "ip_vpn": ip_vpn,
    }
    if description:
        device_yaml["description"] = description
    if tags:
        device_yaml["tags"] = tags
    device_yaml["ssh"] = {
        "username": ssh_username,
        "port": ssh_port,
        "key_path": key_path,
    }
    device_yaml["services"] = []

    config_loader.append_device_to_config(luogo_id, device_yaml)

    # Riallinea il DB alla config aggiornata (upsert + prune coerenti).
    sync_config_to_db(db)

    device = db.get(Device, dev_id)
    if device is None:  # pragma: no cover - non dovrebbe accadere dopo il sync
        raise DeviceCreateError("Creazione device non riuscita dopo la sincronizzazione.")
    logger.info("Device creato: %s (luogo %s).", dev_id, luogo_id)
    return device


def update_device(db: Session, device_id: str, payload) -> Device:
    """Aggiorna un device esistente (id immutabile) e riallinea il DB.

    Consente lo spostamento in un altro luogo. Preserva il blocco `ssh.key_path`
    e la lista `services` gia' presenti nella config. I campi runtime restano
    gestiti dai processi di monitoraggio.

    Solleva:
      - DeviceNotFound: device inesistente;
      - InvalidDeviceData: formato non valido;
      - LuogoNotFound: luogo di destinazione inesistente;
      - DuplicateDevice: hostname/indirizzo gia' in uso da un altro device.
    """
    device_id = (device_id or "").strip()

    name = (payload.name or "").strip()
    hostname = (payload.hostname or "").strip()
    ip_vpn = (payload.ip_vpn or "").strip()
    luogo_id = (payload.luogo_id or "").strip()
    ssh_username = (payload.ssh_username or "").strip()
    ssh_port = payload.ssh_port
    description = (payload.description or "").strip() or None
    tags = [t.strip() for t in (payload.tags or []) if t and t.strip()]

    config = load_devices_config()

    # Trova il device e il suo blocco YAML corrente.
    current = None
    for lg in config.luoghi:
        for d in lg.devices:
            if d.id == device_id:
                current = d
                break
        if current is not None:
            break
    if current is None:
        raise DeviceNotFound(device_id)

    # Validazione di formato.
    if not name:
        raise InvalidDeviceData("Il nome visualizzato e' obbligatorio.")
    if not is_valid_hostname(hostname):
        raise InvalidDeviceData("Hostname non valido.")
    if not is_valid_ip_vpn(ip_vpn):
        raise InvalidDeviceData(
            "Indirizzo VPN/Tailscale non valido: usa un IPv4, un IPv6 "
            "oppure un nome host/MagicDNS."
        )
    if not is_valid_ssh_username(ssh_username):
        raise InvalidDeviceData("Utente SSH non valido.")
    if not (1 <= ssh_port <= 65535):
        raise InvalidDeviceData("Porta SSH non valida (1-65535).")

    # Luogo di destinazione esistente?
    if not any(lg.id == luogo_id for lg in config.luoghi):
        raise LuogoNotFound(luogo_id)

    # Duplicati: hostname/indirizzo di ALTRI device.
    existing_hostnames = {
        d.hostname.strip().lower()
        for lg in config.luoghi
        for d in lg.devices
        if d.id != device_id
    }
    if hostname.lower() in existing_hostnames:
        raise DuplicateDevice("hostname", hostname)

    existing_ips = {
        d.ip_vpn.strip().lower()
        for lg in config.luoghi
        for d in lg.devices
        if d.id != device_id
    }
    if ip_vpn.lower() in existing_ips:
        raise DuplicateDevice("ip_vpn", ip_vpn)

    # Ricostruisce il blocco YAML preservando ssh.key_path, order e services.
    device_yaml: dict = {
        "id": device_id,
        "name": name,
        "hostname": hostname,
        "ip_vpn": ip_vpn,
    }
    if description:
        device_yaml["description"] = description
    if tags:
        device_yaml["tags"] = tags
    device_yaml["ssh"] = {
        "username": ssh_username,
        "port": ssh_port,
        "key_path": current.ssh.key_path,
    }
    if current.order:
        device_yaml["order"] = current.order
    device_yaml["services"] = list(current.services)
    if current.thresholds is not None:
        device_yaml["thresholds"] = current.thresholds.model_dump(exclude_none=True)

    config_loader.update_device_in_config(device_id, device_yaml, luogo_id)

    sync_config_to_db(db)

    device = db.get(Device, device_id)
    if device is None:  # pragma: no cover
        raise DeviceCreateError("Aggiornamento device non riuscito dopo la sincronizzazione.")
    logger.info("Device aggiornato: %s (luogo %s).", device_id, luogo_id)
    return device


def delete_device(db: Session, device_id: str) -> None:
    """Elimina un device dalla config e dal DB (con le righe dipendenti).

    Solleva `DeviceNotFound` se il device non esiste.
    """
    device_id = (device_id or "").strip()
    config = load_devices_config()
    if not any(d.id == device_id for lg in config.luoghi for d in lg.devices):
        raise DeviceNotFound(device_id)

    config_loader.remove_device_from_config(device_id)
    # Il prune in sync elimina device e righe dipendenti non piu' in config.
    sync_config_to_db(db)
    logger.info("Device eliminato: %s.", device_id)


def create_luogo(db: Session, payload) -> Luogo:
    """Crea un nuovo luogo: valida, scrive nella config YAML e sincronizza il DB.

    Solleva:
      - InvalidLuogoData: formato non valido;
      - DuplicateLuogo: id gia' in uso.
    """
    luogo_id = (payload.id or "").strip()
    name = (payload.name or "").strip()
    display_order = payload.display_order

    if not is_valid_luogo_id(luogo_id):
        raise InvalidLuogoData(
            "Identificativo non valido: usa minuscole, numeri, '-' o '_' "
            "(1-64 caratteri, inizio alfanumerico)."
        )
    if not name:
        raise InvalidLuogoData("Il nome del luogo e' obbligatorio.")

    config = load_devices_config()
    if any(lg.id == luogo_id for lg in config.luoghi) or db.get(Luogo, luogo_id):
        raise DuplicateLuogo(f"id gia' in uso: {luogo_id}")

    luogo_yaml: dict = {
        "id": luogo_id,
        "name": name,
        "order": display_order,
        "devices": [],
    }
    config_loader.add_luogo_to_config(luogo_yaml)

    sync_config_to_db(db)

    luogo = db.get(Luogo, luogo_id)
    if luogo is None:  # pragma: no cover
        raise LuogoError("Creazione luogo non riuscita dopo la sincronizzazione.")
    logger.info("Luogo creato: %s.", luogo_id)
    return luogo


def update_luogo(db: Session, luogo_id: str, payload) -> Luogo:
    """Aggiorna nome/ordine di un luogo (l'id e' immutabile).

    Solleva:
      - LuogoNotFound: luogo inesistente;
      - InvalidLuogoData: formato non valido.
    """
    luogo_id = (luogo_id or "").strip()
    name = (payload.name or "").strip()

    config = load_devices_config()
    if not any(lg.id == luogo_id for lg in config.luoghi):
        raise LuogoNotFound(luogo_id)
    if not name:
        raise InvalidLuogoData("Il nome del luogo e' obbligatorio.")

    updates: dict = {"name": name}
    if payload.display_order is not None:
        updates["order"] = payload.display_order

    config_loader.update_luogo_in_config(luogo_id, updates)

    sync_config_to_db(db)

    luogo = db.get(Luogo, luogo_id)
    if luogo is None:  # pragma: no cover
        raise LuogoError("Aggiornamento luogo non riuscito dopo la sincronizzazione.")
    logger.info("Luogo aggiornato: %s.", luogo_id)
    return luogo


def delete_luogo(db: Session, luogo_id: str) -> None:
    """Elimina un luogo VUOTO dalla config e dal DB.

    Solleva:
      - LuogoNotFound: luogo inesistente;
      - LuogoNotEmpty: il luogo contiene ancora dei device.
    """
    luogo_id = (luogo_id or "").strip()
    config = load_devices_config()
    target = next((lg for lg in config.luoghi if lg.id == luogo_id), None)
    if target is None:
        raise LuogoNotFound(luogo_id)
    if target.devices:
        raise LuogoNotEmpty(luogo_id)

    config_loader.remove_luogo_from_config(luogo_id)
    sync_config_to_db(db)
    logger.info("Luogo eliminato: %s.", luogo_id)

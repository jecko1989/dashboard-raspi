"""Caricamento e validazione della configurazione device da YAML.

Legge `config/devices.yaml`, espande le variabili d'ambiente (es. ${SSH_KEYS_DIR})
e ritorna strutture Pydantic tipizzate.
"""
from __future__ import annotations

import os
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SSHConfig(BaseModel):
    username: str
    port: int = 22
    key_path: str


class Thresholds(BaseModel):
    temperature_celsius: float = 70
    disk_percent: float = 85
    ram_percent: float = 85
    cpu_percent: float = 90
    offline_after_failures: int = 3


class DeviceThresholdOverride(BaseModel):
    """Override opzionale delle soglie a livello di singolo device."""

    temperature_celsius: float | None = None
    disk_percent: float | None = None
    ram_percent: float | None = None
    cpu_percent: float | None = None
    offline_after_failures: int | None = None


class DeviceConfig(BaseModel):
    id: str
    name: str
    hostname: str
    ip_vpn: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    ssh: SSHConfig
    services: list[str] = Field(default_factory=list)
    thresholds: DeviceThresholdOverride | None = None
    # Ordine di visualizzazione dentro il luogo (0 = default).
    order: int = 0


class LuogoConfig(BaseModel):
    id: str
    name: str
    devices: list[DeviceConfig] = Field(default_factory=list)
    # Ordine di visualizzazione del luogo (0 = default).
    order: int = 0


class DevicesConfig(BaseModel):
    thresholds: Thresholds = Field(default_factory=Thresholds)
    luoghi: list[LuogoConfig] = Field(default_factory=list)


def _expand_env(value: str) -> str:
    """Espande ${VAR} usando le variabili d'ambiente."""
    return os.path.expandvars(value)


def load_devices_config(path: str | None = None) -> DevicesConfig:
    """Carica e valida la configurazione device dal file YAML."""
    settings = get_settings()
    config_path = Path(path or settings.devices_config_path)

    if not config_path.exists():
        logger.warning("File di configurazione device non trovato: %s", config_path)
        return DevicesConfig()

    raw = config_path.read_text(encoding="utf-8")
    data = yaml.safe_load(raw) or {}

    # Retrocompatibilita': accetta la vecchia chiave 'apartments'.
    if "luoghi" not in data and "apartments" in data:
        data["luoghi"] = data.pop("apartments")

    # Espande le variabili d'ambiente nei key_path.
    for luogo in data.get("luoghi", []):
        for device in luogo.get("devices", []):
            ssh = device.get("ssh", {})
            if "key_path" in ssh:
                ssh["key_path"] = _expand_env(ssh["key_path"])

    config = DevicesConfig.model_validate(data)
    logger.info(
        "Config caricata: %d luoghi, %d device totali.",
        len(config.luoghi),
        sum(len(luogo.devices) for luogo in config.luoghi),
    )
    return config


def get_device_config(config: DevicesConfig, device_id: str) -> DeviceConfig | None:
    """Ritorna la configurazione di un device dato il suo id."""
    for luogo in config.luoghi:
        for device in luogo.devices:
            if device.id == device_id:
                return device
    return None


def resolve_thresholds(config: DevicesConfig, device_id: str) -> Thresholds:
    """Ritorna le soglie effettive per un device: globali + eventuale override."""
    device = get_device_config(config, device_id)
    if device is None or device.thresholds is None:
        return config.thresholds

    override = device.thresholds.model_dump(exclude_none=True)
    merged = config.thresholds.model_dump()
    merged.update(override)
    return Thresholds.model_validate(merged)


def _read_raw(path: str | None = None) -> tuple[Path, dict]:
    """Legge il file YAML grezzo, ritornando (percorso, dati)."""
    settings = get_settings()
    config_path = Path(path or settings.devices_config_path)
    raw = config_path.read_text(encoding="utf-8") if config_path.exists() else ""
    data = yaml.safe_load(raw) or {}
    return config_path, data


def _write_raw(config_path: Path, data: dict) -> None:
    """Serializza e riscrive l'intero file YAML (i commenti non sono preservati)."""
    serialized = yaml.safe_dump(
        data,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
    )
    config_path.write_text(serialized, encoding="utf-8")


def _luoghi(data: dict) -> list:
    """Ritorna la lista dei luoghi, migrando la vecchia chiave 'apartments'."""
    if "luoghi" not in data and "apartments" in data:
        data["luoghi"] = data.pop("apartments")
    luoghi = data.get("luoghi")
    if luoghi is None:
        luoghi = []
        data["luoghi"] = luoghi
    return luoghi


def update_thresholds_in_config(thresholds: dict, path: str | None = None) -> None:
    """Aggiorna le soglie globali nella config YAML."""
    config_path, data = _read_raw(path)
    data["thresholds"] = thresholds
    _write_raw(config_path, data)
    logger.info("Soglie globali aggiornate nella config.")


def append_device_to_config(
    luogo_id: str, device: dict, path: str | None = None
) -> None:
    """Aggiunge un device alla config YAML sotto il luogo indicato.

    Riscrive l'intero file `devices.yaml` (fonte di verita' dei device). I
    commenti presenti nel file non vengono preservati dalla serializzazione.
    Il valore `key_path` deve arrivare gia' con `${SSH_KEYS_DIR}` non espanso.
    Solleva `KeyError` se il luogo non esiste nel file.
    """
    config_path, data = _read_raw(path)
    luoghi = _luoghi(data)

    for luogo in luoghi:
        if luogo.get("id") == luogo_id:
            devices = luogo.get("devices")
            if devices is None:
                devices = []
                luogo["devices"] = devices
            devices.append(device)
            _write_raw(config_path, data)
            logger.info(
                "Device '%s' aggiunto alla config sotto il luogo '%s'.",
                device.get("id"),
                luogo_id,
            )
            return

    raise KeyError(luogo_id)


def update_device_in_config(
    device_id: str, new_device: dict, target_luogo_id: str, path: str | None = None
) -> None:
    """Aggiorna un device nella config (eventualmente spostandolo di luogo).

    Rimuove il device dovunque si trovi e inserisce `new_device` nel luogo di
    destinazione. Solleva `KeyError` se il device o il luogo di destinazione
    non esistono.
    """
    config_path, data = _read_raw(path)
    luoghi = _luoghi(data)

    removed = False
    for luogo in luoghi:
        devices = luogo.get("devices") or []
        for i, dev in enumerate(devices):
            if dev.get("id") == device_id:
                devices.pop(i)
                luogo["devices"] = devices
                removed = True
                break
        if removed:
            break
    if not removed:
        raise KeyError(device_id)

    for luogo in luoghi:
        if luogo.get("id") == target_luogo_id:
            devices = luogo.get("devices")
            if devices is None:
                devices = []
                luogo["devices"] = devices
            devices.append(new_device)
            _write_raw(config_path, data)
            logger.info(
                "Device '%s' aggiornato (luogo '%s').", device_id, target_luogo_id
            )
            return

    raise KeyError(target_luogo_id)


def remove_device_from_config(device_id: str, path: str | None = None) -> None:
    """Rimuove un device dalla config. Solleva `KeyError` se non trovato."""
    config_path, data = _read_raw(path)
    luoghi = _luoghi(data)

    for luogo in luoghi:
        devices = luogo.get("devices") or []
        for i, dev in enumerate(devices):
            if dev.get("id") == device_id:
                devices.pop(i)
                luogo["devices"] = devices
                _write_raw(config_path, data)
                logger.info("Device '%s' rimosso dalla config.", device_id)
                return

    raise KeyError(device_id)


def add_luogo_to_config(luogo: dict, path: str | None = None) -> None:
    """Aggiunge un nuovo luogo alla config."""
    config_path, data = _read_raw(path)
    luoghi = _luoghi(data)
    luoghi.append(luogo)
    _write_raw(config_path, data)
    logger.info("Luogo '%s' aggiunto alla config.", luogo.get("id"))


def update_luogo_in_config(
    luogo_id: str, updates: dict, path: str | None = None
) -> None:
    """Aggiorna i campi di un luogo (non i device). Solleva `KeyError` se assente."""
    config_path, data = _read_raw(path)
    luoghi = _luoghi(data)

    for luogo in luoghi:
        if luogo.get("id") == luogo_id:
            luogo.update(updates)
            _write_raw(config_path, data)
            logger.info("Luogo '%s' aggiornato nella config.", luogo_id)
            return

    raise KeyError(luogo_id)


def remove_luogo_from_config(luogo_id: str, path: str | None = None) -> None:
    """Rimuove un luogo dalla config. Solleva `KeyError` se non trovato."""
    config_path, data = _read_raw(path)
    luoghi = _luoghi(data)

    for i, luogo in enumerate(luoghi):
        if luogo.get("id") == luogo_id:
            luoghi.pop(i)
            _write_raw(config_path, data)
            logger.info("Luogo '%s' rimosso dalla config.", luogo_id)
            return

    raise KeyError(luogo_id)


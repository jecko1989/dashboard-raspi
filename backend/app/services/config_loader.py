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
    # Ordine di visualizzazione dentro l'appartamento (0 = default).
    order: int = 0


class ApartmentConfig(BaseModel):
    id: str
    name: str
    devices: list[DeviceConfig] = Field(default_factory=list)
    # Ordine di visualizzazione dell'appartamento (0 = default).
    order: int = 0


class DevicesConfig(BaseModel):
    thresholds: Thresholds = Field(default_factory=Thresholds)
    apartments: list[ApartmentConfig] = Field(default_factory=list)


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

    # Espande le variabili d'ambiente nei key_path.
    for apartment in data.get("apartments", []):
        for device in apartment.get("devices", []):
            ssh = device.get("ssh", {})
            if "key_path" in ssh:
                ssh["key_path"] = _expand_env(ssh["key_path"])

    config = DevicesConfig.model_validate(data)
    logger.info(
        "Config caricata: %d appartamenti, %d device totali.",
        len(config.apartments),
        sum(len(a.devices) for a in config.apartments),
    )
    return config


def get_device_config(config: DevicesConfig, device_id: str) -> DeviceConfig | None:
    """Ritorna la configurazione di un device dato il suo id."""
    for apartment in config.apartments:
        for device in apartment.devices:
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


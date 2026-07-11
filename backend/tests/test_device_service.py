"""Test della creazione device (validazione, duplicati, persistenza)."""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models  # noqa: F401 - registra i modelli su Base.metadata
from app.core.config import get_settings
from app.db.base import Base
from app.schemas.device import DeviceCreate
from app.services import device_service
from app.services.config_loader import load_devices_config

_CONFIG_YAML = """
thresholds:
  temperature_celsius: 70
  disk_percent: 85
  ram_percent: 85
  cpu_percent: 90
  offline_after_failures: 3
apartments:
  - id: casa_test
    name: "Casa Test"
    order: 1
    devices:
      - id: rpi-esistente-01
        name: "Esistente"
        hostname: "rpi-esistente"
        ip_vpn: "100.64.0.1"
        ssh:
          username: "pi"
          port: 22
          key_path: "${SSH_KEYS_DIR}/id_esistente"
        services: []
"""


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def config_file(tmp_path, monkeypatch):
    path = tmp_path / "devices.yaml"
    path.write_text(_CONFIG_YAML, encoding="utf-8")
    monkeypatch.setattr(get_settings(), "devices_config_path", str(path))
    return path


def _payload(**overrides) -> DeviceCreate:
    data = {
        "id": "rpi-nuovo-01",
        "name": "Raspberry Nuovo 01",
        "hostname": "rpi-nuovo",
        "ip_vpn": "rpi-nuovo",
        "apartment_id": "casa_test",
        "ssh_username": "pi",
        "ssh_port": 22,
    }
    data.update(overrides)
    return DeviceCreate(**data)


# --- Validatori di formato ---------------------------------------------------


def test_is_valid_device_id() -> None:
    assert device_service.is_valid_device_id("rpi-casa-01")
    assert device_service.is_valid_device_id("rpi_casa_01")
    assert not device_service.is_valid_device_id("Rpi-Casa")  # maiuscole
    assert not device_service.is_valid_device_id("-rpi")  # inizio non alfanumerico
    assert not device_service.is_valid_device_id("")


def test_is_valid_hostname() -> None:
    assert device_service.is_valid_hostname("rpi-casa-01")
    assert device_service.is_valid_hostname("rpi.example.ts.net")
    assert not device_service.is_valid_hostname("-bad")
    assert not device_service.is_valid_hostname("bad host")
    assert not device_service.is_valid_hostname("")


def test_is_valid_ip_vpn() -> None:
    assert device_service.is_valid_ip_vpn("100.64.0.10")  # IPv4
    assert device_service.is_valid_ip_vpn("fd7a:115c:a1e0::1")  # IPv6
    assert device_service.is_valid_ip_vpn("rpi-casa-mia")  # MagicDNS
    assert not device_service.is_valid_ip_vpn("indirizzo non valido!")
    assert not device_service.is_valid_ip_vpn("")


# --- create_device -----------------------------------------------------------


def test_create_device_success(db, config_file) -> None:
    device = device_service.create_device(db, _payload())

    assert device.id == "rpi-nuovo-01"
    assert device.apartment_id == "casa_test"
    assert device.ssh_username == "pi"
    # Campi runtime NON impostati artificialmente.
    assert device.is_online is False
    assert device.last_latency_ms is None
    assert device.last_checked_at is None

    # Persistito nella config YAML (fonte di verita').
    config = load_devices_config()
    ids = {d.id for a in config.apartments for d in a.devices}
    assert "rpi-nuovo-01" in ids


def test_create_device_trims_whitespace(db, config_file) -> None:
    device = device_service.create_device(
        db, _payload(id="  rpi-nuovo-01  ", name="  Nuovo  ", hostname="  rpi-nuovo  ")
    )
    assert device.id == "rpi-nuovo-01"
    assert device.name == "Nuovo"
    assert device.hostname == "rpi-nuovo"


def test_create_device_invalid_id(db, config_file) -> None:
    with pytest.raises(device_service.InvalidDeviceData):
        device_service.create_device(db, _payload(id="Rpi_BAD"))


def test_create_device_invalid_hostname(db, config_file) -> None:
    with pytest.raises(device_service.InvalidDeviceData):
        device_service.create_device(db, _payload(hostname="-non valido-"))


def test_create_device_invalid_ip(db, config_file) -> None:
    with pytest.raises(device_service.InvalidDeviceData):
        device_service.create_device(db, _payload(ip_vpn="indirizzo!!!"))


def test_create_device_invalid_port(db, config_file) -> None:
    with pytest.raises(device_service.InvalidDeviceData):
        device_service.create_device(db, _payload(ssh_port=70000))


def test_create_device_duplicate_id(db, config_file) -> None:
    with pytest.raises(device_service.DuplicateDevice) as exc:
        device_service.create_device(db, _payload(id="rpi-esistente-01"))
    assert exc.value.field == "id"


def test_create_device_duplicate_hostname(db, config_file) -> None:
    with pytest.raises(device_service.DuplicateDevice) as exc:
        device_service.create_device(db, _payload(hostname="rpi-esistente"))
    assert exc.value.field == "hostname"


def test_create_device_duplicate_ip(db, config_file) -> None:
    with pytest.raises(device_service.DuplicateDevice) as exc:
        device_service.create_device(db, _payload(ip_vpn="100.64.0.1"))
    assert exc.value.field == "ip_vpn"


def test_create_device_apartment_not_found(db, config_file) -> None:
    with pytest.raises(device_service.ApartmentNotFound):
        device_service.create_device(db, _payload(apartment_id="inesistente"))

"""Test della creazione device (validazione, duplicati, persistenza)."""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models  # noqa: F401 - registra i modelli su Base.metadata
from app.core.config import get_settings
from app.db.base import Base
from app.schemas.device import DeviceCreate, DeviceUpdate
from app.schemas.luogo import LuogoCreate, LuogoUpdate
from app.services import device_service
from app.services.config_loader import load_devices_config
_CONFIG_YAML = """
thresholds:
  temperature_celsius: 70
  disk_percent: 85
  ram_percent: 85
  cpu_percent: 90
  offline_after_failures: 3
luoghi:
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
  - id: casa_vuota
    name: "Casa Vuota"
    order: 2
    devices: []
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
        "luogo_id": "casa_test",
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
    assert device.luogo_id == "casa_test"
    assert device.ssh_username == "pi"
    # Campi runtime NON impostati artificialmente.
    assert device.is_online is False
    assert device.last_latency_ms is None
    assert device.last_checked_at is None

    # Persistito nella config YAML (fonte di verita').
    config = load_devices_config()
    ids = {d.id for lg in config.luoghi for d in lg.devices}
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


def test_create_device_duplicate_ip(db, config_file) -> None:
    with pytest.raises(device_service.DuplicateDevice) as exc:
        device_service.create_device(db, _payload(ip_vpn="100.64.0.1"))
    assert exc.value.field == "ip_vpn"


def test_create_device_luogo_not_found(db, config_file) -> None:
    with pytest.raises(device_service.LuogoNotFound):
        device_service.create_device(db, _payload(luogo_id="inesistente"))


# --- update_device -----------------------------------------------------------


def _update_payload(**overrides) -> DeviceUpdate:
    data = {
        "name": "Esistente Rinominato",
        "hostname": "rpi-esistente",
        "ip_vpn": "100.64.0.1",
        "luogo_id": "casa_test",
        "ssh_username": "pi",
        "ssh_port": 22,
    }
    data.update(overrides)
    return DeviceUpdate(**data)


def test_update_device_success(db, config_file) -> None:
    device_service.sync_config_to_db(db)
    updated = device_service.update_device(
        db, "rpi-esistente-01", _update_payload(name="Nuovo Nome", tags=["prod"])
    )
    assert updated.name == "Nuovo Nome"
    assert updated.tags == ["prod"]
    # La chiave SSH preesistente e' preservata.
    assert updated.ssh_key_path.endswith("id_esistente")


def test_update_device_move_luogo(db, config_file) -> None:
    device_service.sync_config_to_db(db)
    updated = device_service.update_device(
        db, "rpi-esistente-01", _update_payload(luogo_id="casa_vuota")
    )
    assert updated.luogo_id == "casa_vuota"


def test_update_device_not_found(db, config_file) -> None:
    with pytest.raises(device_service.DeviceNotFound):
        device_service.update_device(db, "inesistente", _update_payload())


def test_update_device_luogo_not_found(db, config_file) -> None:
    with pytest.raises(device_service.LuogoNotFound):
        device_service.update_device(
            db, "rpi-esistente-01", _update_payload(luogo_id="mancante")
        )


def test_update_device_invalid_hostname(db, config_file) -> None:
    with pytest.raises(device_service.InvalidDeviceData):
        device_service.update_device(
            db, "rpi-esistente-01", _update_payload(hostname="-non valido-")
        )


# --- delete_device -----------------------------------------------------------


def test_delete_device_success(db, config_file) -> None:
    device_service.sync_config_to_db(db)
    device_service.delete_device(db, "rpi-esistente-01")
    config = load_devices_config()
    ids = {d.id for lg in config.luoghi for d in lg.devices}
    assert "rpi-esistente-01" not in ids


def test_delete_device_not_found(db, config_file) -> None:
    with pytest.raises(device_service.DeviceNotFound):
        device_service.delete_device(db, "inesistente")


# --- CRUD luoghi -------------------------------------------------------------


def test_create_luogo_success(db, config_file) -> None:
    luogo = device_service.create_luogo(
        db, LuogoCreate(id="casa_nuova", name="Casa Nuova", display_order=5)
    )
    assert luogo.id == "casa_nuova"
    assert luogo.display_order == 5
    config = load_devices_config()
    assert any(lg.id == "casa_nuova" for lg in config.luoghi)


def test_create_luogo_duplicate(db, config_file) -> None:
    with pytest.raises(device_service.DuplicateLuogo):
        device_service.create_luogo(db, LuogoCreate(id="casa_test", name="Doppione"))


def test_create_luogo_invalid_id(db, config_file) -> None:
    with pytest.raises(device_service.InvalidLuogoData):
        device_service.create_luogo(db, LuogoCreate(id="Casa BAD", name="X"))


def test_update_luogo_success(db, config_file) -> None:
    device_service.sync_config_to_db(db)
    updated = device_service.update_luogo(
        db, "casa_test", LuogoUpdate(name="Casa Test 2", display_order=9)
    )
    assert updated.name == "Casa Test 2"
    assert updated.display_order == 9


def test_update_luogo_not_found(db, config_file) -> None:
    with pytest.raises(device_service.LuogoNotFound):
        device_service.update_luogo(db, "mancante", LuogoUpdate(name="X"))


def test_delete_luogo_empty(db, config_file) -> None:
    device_service.sync_config_to_db(db)
    device_service.delete_luogo(db, "casa_vuota")
    config = load_devices_config()
    assert not any(lg.id == "casa_vuota" for lg in config.luoghi)


def test_delete_luogo_not_empty(db, config_file) -> None:
    device_service.sync_config_to_db(db)
    with pytest.raises(device_service.LuogoNotEmpty):
        device_service.delete_luogo(db, "casa_test")


def test_delete_luogo_not_found(db, config_file) -> None:
    with pytest.raises(device_service.LuogoNotFound):
        device_service.delete_luogo(db, "mancante")

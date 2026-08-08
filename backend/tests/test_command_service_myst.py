"""Test della risoluzione dei comandi myst_start/stop/restart per device.

L'allowlist e' condivisa da tutta la flotta: alcuni Raspberry hanno Mysterium
nativo (systemd), altri containerizzato (Docker). Questi test verificano che
_resolve_myst_command_key scelga la variante corretta in base al flag
DeviceConfig.myst_docker, senza rompere i device che non lo hanno impostato.
"""
from __future__ import annotations

import pytest

from app.core.config import get_settings
from app.models.device import Device
from app.services import command_service

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
      - id: rpi-nativo
        name: "Nativo"
        hostname: "rpi-nativo"
        ip_vpn: "100.64.0.1"
        ssh:
          username: "pi"
          port: 22
          key_path: "${SSH_KEYS_DIR}/id_nativo"
        services: []
      - id: rpi-docker
        name: "Docker"
        hostname: "rpi-docker"
        ip_vpn: "100.64.0.2"
        ssh:
          username: "pi"
          port: 22
          key_path: "${SSH_KEYS_DIR}/id_docker"
        myst_docker: true
        services: []
"""


@pytest.fixture()
def config_file(tmp_path, monkeypatch):
    path = tmp_path / "devices.yaml"
    path.write_text(_CONFIG_YAML, encoding="utf-8")
    monkeypatch.setattr(get_settings(), "devices_config_path", str(path))
    return path


def _device(device_id: str) -> Device:
    return Device(
        id=device_id,
        name=device_id,
        hostname=device_id,
        ip_vpn="100.64.0.1",
        luogo_id="casa_test",
        ssh_username="pi",
        ssh_port=22,
        ssh_key_path="/tmp/key",
    )


def test_myst_resolve_native_by_default(config_file) -> None:
    key = command_service._resolve_myst_command_key("myst_start", _device("rpi-nativo"))
    assert key == "myst_start_native"


def test_myst_resolve_docker_when_flagged(config_file) -> None:
    key = command_service._resolve_myst_command_key("myst_stop", _device("rpi-docker"))
    assert key == "myst_stop_docker"


def test_myst_resolve_unknown_device_defaults_native(config_file) -> None:
    # Device non presente in config (es. rimosso): fallback sicuro a nativo,
    # mai al comando docker (evita di eseguire 'docker ...' su chi non lo ha).
    key = command_service._resolve_myst_command_key("myst_restart", _device("rpi-sconosciuto"))
    assert key == "myst_restart_native"


def test_myst_resolve_leaves_other_keys_untouched(config_file) -> None:
    assert command_service._resolve_myst_command_key("reboot", _device("rpi-docker")) == "reboot"
    assert command_service._resolve_myst_command_key("myst_backup", _device("rpi-docker")) == "myst_backup"


def test_build_command_myst_native_vs_docker(config_file) -> None:
    native = command_service._build_command("myst_start", _device("rpi-nativo"), None)
    docker = command_service._build_command("myst_start", _device("rpi-docker"), None)
    assert "systemctl start mysterium-node" in native
    assert "docker start myst" in docker

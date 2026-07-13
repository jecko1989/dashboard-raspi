"""Test del resolver e dell'aggiornamento delle soglie."""
from __future__ import annotations

import pytest
import yaml
from fastapi import HTTPException

from app.api.routes.monitoring import update_thresholds
from app.core.config import get_settings
from app.models.user import User
from app.schemas.settings import ThresholdsUpdate
from app.services.config_loader import (
    DeviceConfig,
    DevicesConfig,
    DeviceThresholdOverride,
    LuogoConfig,
    SSHConfig,
    Thresholds,
    load_devices_config,
    resolve_thresholds,
    update_thresholds_in_config,
)


def _write_config(path, thresholds: dict | None = None) -> None:
    path.write_text(
        yaml.safe_dump(
            {
                "thresholds": thresholds
                or {
                    "temperature_celsius": 70,
                    "disk_percent": 85,
                    "ram_percent": 85,
                    "cpu_percent": 90,
                    "offline_after_failures": 3,
                },
                "luoghi": [],
            },
            sort_keys=False,
            allow_unicode=True,
        ),
        encoding="utf-8",
    )


def test_update_thresholds_in_config_persists_values(tmp_path) -> None:
    path = tmp_path / "devices.yaml"
    _write_config(path)

    update_thresholds_in_config(
        {
            "temperature_celsius": 68,
            "disk_percent": 80,
            "ram_percent": 81,
            "cpu_percent": 82,
            "offline_after_failures": 4,
        },
        str(path),
    )

    config = load_devices_config(str(path))
    assert config.thresholds.temperature_celsius == 68
    assert config.thresholds.disk_percent == 80
    assert config.thresholds.ram_percent == 81
    assert config.thresholds.cpu_percent == 82
    assert config.thresholds.offline_after_failures == 4


def test_update_thresholds_requires_admin(tmp_path, monkeypatch) -> None:
    path = tmp_path / "devices.yaml"
    _write_config(path)
    monkeypatch.setattr(get_settings(), "devices_config_path", str(path))

    with pytest.raises(HTTPException) as exc:
        update_thresholds(
            ThresholdsUpdate(
                temperature_celsius=68,
                disk_percent=80,
                ram_percent=81,
                cpu_percent=82,
                offline_after_failures=4,
            ),
            current_user=User(
                username="viewer",
                hashed_password="x",
                is_admin=False,
                is_active=True,
            ),
        )

    assert exc.value.status_code == 403


def test_update_thresholds_route_persists_config(tmp_path, monkeypatch) -> None:
    path = tmp_path / "devices.yaml"
    _write_config(path)
    monkeypatch.setattr(get_settings(), "devices_config_path", str(path))

    updated = update_thresholds(
        ThresholdsUpdate(
            temperature_celsius=66,
            disk_percent=79,
            ram_percent=78,
            cpu_percent=88,
            offline_after_failures=5,
        ),
        current_user=User(
            username="admin",
            hashed_password="x",
            is_admin=True,
            is_active=True,
        ),
    )

    assert updated.temperature_celsius == 66
    config = load_devices_config(str(path))
    assert config.thresholds.cpu_percent == 88
    assert config.thresholds.offline_after_failures == 5
def _make_config(override: DeviceThresholdOverride | None) -> DevicesConfig:
    device = DeviceConfig(
        id="dev1",
        name="Dev 1",
        hostname="host1",
        ip_vpn="10.8.0.10",
        ssh=SSHConfig(username="pi", port=22, key_path="/tmp/key"),
        thresholds=override,
    )
    luogo = LuogoConfig(id="lg1", name="Luogo 1", devices=[device])
    return DevicesConfig(
        thresholds=Thresholds(temperature_celsius=70, disk_percent=85),
        luoghi=[luogo],
    )


def test_resolve_uses_global_without_override() -> None:
    config = _make_config(None)
    thr = resolve_thresholds(config, "dev1")
    assert thr.temperature_celsius == 70
    assert thr.disk_percent == 85


def test_resolve_applies_override() -> None:
    config = _make_config(DeviceThresholdOverride(temperature_celsius=60))
    thr = resolve_thresholds(config, "dev1")
    assert thr.temperature_celsius == 60  # override
    assert thr.disk_percent == 85  # globale invariata


def test_resolve_unknown_device_returns_global() -> None:
    config = _make_config(None)
    thr = resolve_thresholds(config, "inesistente")
    assert thr.temperature_celsius == 70

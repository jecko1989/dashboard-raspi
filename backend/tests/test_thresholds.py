"""Test del resolver delle soglie (globali + override per-device)."""
from __future__ import annotations

from app.services.config_loader import (
    DeviceConfig,
    DevicesConfig,
    DeviceThresholdOverride,
    LuogoConfig,
    SSHConfig,
    Thresholds,
    resolve_thresholds,
)


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

"""Test dell'allowlist e della validazione dei nomi servizio."""
from __future__ import annotations

from app.ssh import allowlist


def test_privileged_commands_present() -> None:
    for key in ("reboot", "shutdown", "update_check", "update_upgrade",
                "update_dry_run", "service_restart", "service_status", "service_logs",
                "fan_mode_pwm", "fan_mode_fixed"):
        assert key in allowlist.PRIVILEGED_COMMANDS


def test_is_allowed() -> None:
    assert allowlist.is_allowed("reboot")
    assert allowlist.is_allowed("cpu")  # read-only
    assert not allowlist.is_allowed("rm -rf /")


def test_valid_service_names() -> None:
    assert allowlist.is_valid_service_name("ssh")
    assert allowlist.is_valid_service_name("nginx.service")
    assert allowlist.is_valid_service_name("getty@tty1")


def test_invalid_service_names_block_injection() -> None:
    assert not allowlist.is_valid_service_name("ssh; rm -rf /")
    assert not allowlist.is_valid_service_name("ssh && reboot")
    assert not allowlist.is_valid_service_name("$(whoami)")
    assert not allowlist.is_valid_service_name("a b")
    assert not allowlist.is_valid_service_name("")


def test_service_template_uses_only_validated_name() -> None:
    # Il template contiene il placeholder, non permette comandi arbitrari.
    template = allowlist.PRIVILEGED_COMMANDS["service_restart"]
    assert "{service}" in template
    assert template.startswith("sudo /bin/systemctl restart")


def test_pwm_value_validation() -> None:
    assert allowlist.is_valid_pwm_value(0)
    assert allowlist.is_valid_pwm_value(128)
    assert allowlist.is_valid_pwm_value(255)
    assert not allowlist.is_valid_pwm_value(-1)
    assert not allowlist.is_valid_pwm_value(256)

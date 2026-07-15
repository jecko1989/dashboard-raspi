"""Test dei parser delle metriche."""
from __future__ import annotations

from app.services import metric_parsers as p


def test_parse_cpu_percent() -> None:
    out = "%Cpu(s):  3.2 us,  1.1 sy,  0.0 ni, 95.0 id,  0.7 wa"
    assert p.parse_cpu_percent(out) == 5.0


def test_parse_ram_percent() -> None:
    # total used free shared buff/cache available
    out = (
        "               total        used        free      shared  buff/cache   available\n"
        "Mem:      1000        400        200          10         400         600\n"
    )
    # (1000 - 600) / 1000 * 100 = 40.0
    assert p.parse_ram_percent(out) == 40.0


def test_parse_disk_percent() -> None:
    out = (
        "Filesystem     1B-blocks      Used Available Use% Mounted on\n"
        "/dev/root      1000000000 850000000 150000000  85% /\n"
    )
    assert p.parse_disk_percent(out) == 85.0


def test_parse_temperature() -> None:
    assert p.parse_temperature("48123\n") == 48.1


def test_parse_uptime_seconds() -> None:
    assert p.parse_uptime_seconds("12345.67 9999.00") == 12345.7


def test_parse_load_average_1m() -> None:
    assert p.parse_load_average_1m("0.15 0.10 0.05 1/123 4567") == 0.15


def test_parse_fan_rpm() -> None:
    assert p.parse_fan_rpm("1234\n") == 1234.0


def test_parse_fan_mode() -> None:
    assert p.parse_fan_mode("2\n") == "auto"
    assert p.parse_fan_mode("1\n") == "fixed"
    assert p.parse_fan_mode("0\n") == "off"


def test_parse_os_version() -> None:
    out = 'NAME="Debian"\nPRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\n'
    assert p.parse_os_version(out) == "Debian GNU/Linux 12 (bookworm)"


def test_parsers_return_none_on_garbage() -> None:
    assert p.parse_cpu_percent("garbage") is None
    assert p.parse_disk_percent("") is None
    assert p.parse_temperature("not-a-number") is None
    assert p.parse_fan_rpm("") is None
    assert p.parse_fan_mode("") is None

"""Parser degli output dei comandi shell in valori metrici tipizzati.

Ogni funzione e' difensiva: ritorna None se l'output non e' interpretabile,
cosi' un singolo comando fallito non compromette l'intera raccolta.
"""
from __future__ import annotations

import re


def parse_cpu_percent(output: str) -> float | None:
    """Estrae l'uso CPU da `top -bn1 | grep 'Cpu(s)'` come 100 - idle."""
    # Esempio: "%Cpu(s):  3.2 us,  1.1 sy,  0.0 ni, 95.0 id, ..."
    match = re.search(r"([\d.]+)\s*id", output)
    if not match:
        return None
    try:
        idle = float(match.group(1))
    except ValueError:
        return None
    return round(max(0.0, min(100.0, 100.0 - idle)), 1)


def parse_ram_percent(output: str) -> float | None:
    """Estrae la percentuale RAM usata da `free -b`.

    Usa (total - available) / total quando 'available' e' presente, altrimenti
    used/total.
    """
    for line in output.splitlines():
        parts = line.split()
        if not parts or not parts[0].lower().startswith("mem"):
            continue
        try:
            total = float(parts[1])
            used = float(parts[2])
            available = float(parts[6]) if len(parts) >= 7 else None
        except (IndexError, ValueError):
            return None
        if total <= 0:
            return None
        effective_used = (total - available) if available is not None else used
        return round(effective_used / total * 100.0, 1)
    return None


def parse_disk_percent(output: str) -> float | None:
    """Estrae la percentuale disco usata da `df -B1 /`."""
    lines = output.strip().splitlines()
    if len(lines) < 2:
        return None
    match = re.search(r"(\d+)%", lines[1])
    if not match:
        return None
    return float(match.group(1))


def parse_temperature(output: str) -> float | None:
    """Converte `cat /sys/class/thermal/thermal_zone0/temp` (milligradi) in gradi C."""
    raw = output.strip()
    if not raw.isdigit():
        return None
    return round(int(raw) / 1000.0, 1)


def parse_uptime_seconds(output: str) -> float | None:
    """Estrae i secondi di uptime da `cat /proc/uptime`."""
    parts = output.split()
    if not parts:
        return None
    try:
        return round(float(parts[0]), 1)
    except ValueError:
        return None


def parse_load_average_1m(output: str) -> float | None:
    """Estrae il load average a 1 minuto da `cat /proc/loadavg`."""
    parts = output.split()
    if not parts:
        return None
    try:
        return float(parts[0])
    except ValueError:
        return None


def parse_os_version(output: str) -> str | None:
    """Estrae PRETTY_NAME da `cat /etc/os-release`."""
    match = re.search(r'PRETTY_NAME="?([^"\n]+)"?', output)
    return match.group(1).strip() if match else None


def parse_kernel(output: str) -> str | None:
    """Ritorna la versione kernel da `uname -r`."""
    value = output.strip()
    return value or None

"""Schemi Pydantic per le impostazioni (soglie)."""
from __future__ import annotations

from pydantic import BaseModel


class ThresholdsRead(BaseModel):
    temperature_celsius: float
    disk_percent: float
    ram_percent: float
    cpu_percent: float
    offline_after_failures: int

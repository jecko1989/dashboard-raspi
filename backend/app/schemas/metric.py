"""Schemi Pydantic per le metriche."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MetricRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: str
    collected_at: datetime
    cpu_percent: float | None = None
    ram_percent: float | None = None
    disk_percent: float | None = None
    temperature_celsius: float | None = None
    load_average_1m: float | None = None
    uptime_seconds: float | None = None
    fan_rpm: float | None = None
    fan_mode: str | None = None
    os_version: str | None = None
    kernel: str | None = None

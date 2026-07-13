"""Schemi Pydantic per le impostazioni (soglie)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ThresholdsBase(BaseModel):
    temperature_celsius: float = Field(ge=1, le=120)
    disk_percent: float = Field(ge=1, le=100)
    ram_percent: float = Field(ge=1, le=100)
    cpu_percent: float = Field(ge=1, le=100)
    offline_after_failures: int = Field(ge=1)


class ThresholdsRead(ThresholdsBase):
    pass


class ThresholdsUpdate(ThresholdsBase):
    pass

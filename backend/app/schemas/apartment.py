"""Schemi Pydantic per gli appartamenti."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ApartmentBase(BaseModel):
    id: str
    name: str


class ApartmentRead(ApartmentBase):
    model_config = ConfigDict(from_attributes=True)

    device_count: int = 0
    display_order: int = 0

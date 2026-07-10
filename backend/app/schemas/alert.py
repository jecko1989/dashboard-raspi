"""Schemi Pydantic per alert ed eventi."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AlertRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: str
    type: str
    severity: str
    message: str
    is_resolved: bool
    created_at: datetime
    resolved_at: datetime | None = None


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: str | None = None
    type: str
    message: str
    created_at: datetime

"""Schemi Pydantic per i dispositivi."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DeviceBase(BaseModel):
    id: str
    name: str
    hostname: str
    ip_vpn: str
    description: str | None = None
    apartment_id: str
    ssh_username: str
    ssh_port: int = 22


class DeviceRead(DeviceBase):
    """Rappresentazione read-only di un device (senza dati sensibili come key_path)."""

    model_config = ConfigDict(from_attributes=True)

    is_online: bool = False
    alerts_muted: bool = False
    last_latency_ms: float | None = None
    last_checked_at: datetime | None = None
    last_metric_at: datetime | None = None
    tags: list[str] = []
    display_order: int = 0
    # Comando SSH pronto da copiare (path chiave incluso, ma nessun segreto).
    ssh_command: str | None = None

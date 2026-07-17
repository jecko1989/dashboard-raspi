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
    luogo_id: str
    ssh_username: str
    ssh_port: int = 22


class DeviceCreate(BaseModel):
    """Payload per la creazione di un nuovo device dalla dashboard.

    La validazione di formato, i duplicati e l'esistenza del luogo sono
    verificati nel service (`device_service.create_device`). Qui restano solo i
    tipi: i campi runtime (online, latenza, ultima verifica) non sono impostabili
    dall'utente perche' gestiti dai processi di monitoraggio.
    """

    id: str
    name: str
    hostname: str
    ip_vpn: str
    luogo_id: str
    ssh_username: str
    ssh_port: int = 22
    description: str | None = None
    tags: list[str] = []


class DeviceUpdate(BaseModel):
    """Payload per la modifica di un device (l'id e' immutabile).

    I campi runtime non sono modificabili qui. La validazione, i duplicati e
    l'esistenza del luogo di destinazione sono verificati nel service.
    """

    name: str
    hostname: str
    ip_vpn: str
    luogo_id: str
    ssh_username: str
    ssh_port: int = 22
    description: str | None = None
    tags: list[str] = []


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


class DeviceServiceUpdateRequest(BaseModel):
    """Payload per aggiungere un servizio monitorato al device."""

    name: str
    confirm: bool = False


class DeviceServicesRead(BaseModel):
    """Lista servizi monitorati configurati per un device."""

    device_id: str
    services: list[str]

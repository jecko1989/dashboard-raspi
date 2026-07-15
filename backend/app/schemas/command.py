"""Schemi Pydantic per servizi e comandi remoti."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ServiceStatus(BaseModel):
    name: str
    active: bool
    status: str = "unknown"


class CommandRequest(BaseModel):
    """Richiesta di comando remoto. `confirm` deve essere True per comandi distruttivi."""

    confirm: bool = False
    # Solo per l'update: se True esegue una simulazione (apt-get -s upgrade).
    dry_run: bool = False


class TailscaleAdvertiseRequest(CommandRequest):
    """Richiesta di annuncio Tailscale: exit node e/o subnet route."""

    exit_node: bool = False
    routes: bool = False


class MystRequest(CommandRequest):
    """Controllo del nodo Mysterium: avvio o arresto."""

    action: Literal["start", "stop"] = "stop"


class FanControlRequest(CommandRequest):
    """Impostazione ventola: PWM automatico o fixed con target rpm."""

    mode: Literal["pwm", "fixed"] = "pwm"
    rpm: int | None = Field(default=None, ge=300, le=9000)


class SSHKeyGenerateRequest(BaseModel):
    """Richiesta di generazione chiave SSH per un device."""

    confirm: bool = False
    # Se True sovrascrive una chiave esistente (rompe l'accesso attuale!).
    force: bool = False


class SSHKeyResult(BaseModel):
    device_id: str
    public_key: str
    key_path: str
    saved: bool
    # Presente SOLO se la chiave non è stata salvata su disco (es. mount read-only).
    private_key: str | None = None
    install_command: str
    manual_hint: str
    detail: str | None = None


class CommandResult(BaseModel):
    device_id: str
    command: str
    status: str
    detail: str | None = None


class ServiceLogs(BaseModel):
    service: str
    logs: str


class CommandAuditRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: str
    requested_by: str | None = None
    command: str
    target: str | None = None
    status: str
    detail: str | None = None
    created_at: datetime

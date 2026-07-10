"""Endpoint di monitoraggio: trigger manuali di check/raccolta.

Azioni sicure e idempotenti (non modificano lo stato dei Raspberry): sono
separate sia dagli endpoint read-only sia dagli endpoint di comando.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.device import DeviceRead
from app.schemas.settings import ThresholdsRead
from app.services import device_service, metrics_service
from app.services.config_loader import load_devices_config

router = APIRouter(tags=["monitoring"])


def _device_read(db: Session, device) -> DeviceRead:
    data = DeviceRead.model_validate(device)
    data.ssh_command = device_service.build_ssh_command(device)
    return data


@router.post("/monitoring/refresh")
def refresh_all(db: Session = Depends(get_db)) -> dict[str, str]:
    """Esegue subito un ciclo di monitoraggio su tutti i device."""
    metrics_service.run_collection_cycle(db)
    return {"status": "ok"}


@router.post("/devices/{device_id}/check", response_model=DeviceRead)
def check_device(device_id: str, db: Session = Depends(get_db)) -> DeviceRead:
    """Esegue subito check reachability + raccolta metriche per un device."""
    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device non trovato")

    config = load_devices_config()
    metrics_service.check_and_collect(db, device, config)
    db.refresh(device)
    return _device_read(db, device)


@router.post("/devices/{device_id}/alerts/mute", response_model=DeviceRead)
def mute_alerts(device_id: str, db: Session = Depends(get_db)) -> DeviceRead:
    """Silenzia temporaneamente gli alert di un device."""
    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device non trovato")
    device.alerts_muted = True
    db.commit()
    db.refresh(device)
    return _device_read(db, device)


@router.post("/devices/{device_id}/alerts/unmute", response_model=DeviceRead)
def unmute_alerts(device_id: str, db: Session = Depends(get_db)) -> DeviceRead:
    """Riattiva gli alert di un device."""
    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device non trovato")
    device.alerts_muted = False
    db.commit()
    db.refresh(device)
    return _device_read(db, device)


@router.get("/settings/thresholds", response_model=ThresholdsRead)
def get_thresholds() -> ThresholdsRead:
    """Ritorna le soglie globali configurate per gli alert."""
    config = load_devices_config()
    return ThresholdsRead.model_validate(config.thresholds.model_dump())

"""Endpoint di scrittura sui device (creazione).

Separato dagli endpoint read-only: modifica la config `devices.yaml` (fonte di
verita' dei device) e riallinea il DB. Protetto da JWT tramite il router
aggregato. I campi runtime (online, latenza, ultima verifica) non sono
impostabili dall'utente: restano gestiti dai processi di monitoraggio.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.device import DeviceCreate, DeviceRead
from app.services import device_service

router = APIRouter(tags=["devices"])


def _to_device_read(device) -> DeviceRead:
    """Converte un modello Device in schema DeviceRead con comando SSH pronto."""
    data = DeviceRead.model_validate(device)
    data.ssh_command = device_service.build_ssh_command(device)
    return data


@router.post(
    "/devices",
    response_model=DeviceRead,
    status_code=status.HTTP_201_CREATED,
)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db)) -> DeviceRead:
    """Crea un nuovo device e lo persiste nella config YAML + DB."""
    try:
        device = device_service.create_device(db, payload)
    except device_service.ApartmentNotFound as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=f"Appartamento non trovato: {exc.args[0] if exc.args else ''}",
        ) from exc
    except device_service.DuplicateDevice as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except device_service.InvalidDeviceData as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_device_read(device)

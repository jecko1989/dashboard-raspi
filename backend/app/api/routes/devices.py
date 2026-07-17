"""Endpoint di scrittura sui device (creazione, modifica, eliminazione).

Separato dagli endpoint read-only: modifica la config `devices.yaml` (fonte di
verita' dei device) e riallinea il DB. Protetto da JWT tramite il router
aggregato. I campi runtime (online, latenza, ultima verifica) non sono
impostabili dall'utente: restano gestiti dai processi di monitoraggio.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.device import (
    DeviceCreate,
    DeviceRead,
    DeviceServicesRead,
    DeviceServiceUpdateRequest,
    DeviceUpdate,
)
from app.services import device_service

router = APIRouter(tags=["devices"])


def _require_admin(current_user: User) -> None:
    if not current_user.is_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Operazione riservata agli amministratori",
        )


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
    except device_service.LuogoNotFound as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=f"Luogo non trovato: {exc.args[0] if exc.args else ''}",
        ) from exc
    except device_service.DuplicateDevice as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except device_service.InvalidDeviceData as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_device_read(device)


@router.put("/devices/{device_id}", response_model=DeviceRead)
def update_device(
    device_id: str, payload: DeviceUpdate, db: Session = Depends(get_db)
) -> DeviceRead:
    """Aggiorna un device esistente (config YAML + DB)."""
    try:
        device = device_service.update_device(db, device_id, payload)
    except device_service.DeviceNotFound as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Device non trovato"
        ) from exc
    except device_service.LuogoNotFound as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=f"Luogo non trovato: {exc.args[0] if exc.args else ''}",
        ) from exc
    except device_service.DuplicateDevice as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except device_service.InvalidDeviceData as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_device_read(device)


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: str, db: Session = Depends(get_db)):
    """Elimina un device dalla config YAML e dal DB."""
    try:
        device_service.delete_device(db, device_id)
    except device_service.DeviceNotFound as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Device non trovato"
        ) from exc


@router.post("/devices/{device_id}/services", response_model=DeviceServicesRead)
def add_device_service(
    device_id: str,
    payload: DeviceServiceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeviceServicesRead:
    """Aggiunge un servizio monitorato a un device (config YAML + DB)."""
    _require_admin(current_user)
    if not payload.confirm:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Conferma richiesta: impostare confirm=true",
        )
    try:
        services = device_service.add_monitored_service(db, device_id, payload.name)
    except device_service.DeviceNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device non trovato") from exc
    except device_service.DuplicateService as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except device_service.InvalidServiceName as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return DeviceServicesRead(device_id=device_id, services=services)


@router.delete("/devices/{device_id}/services/{service_name}", response_model=DeviceServicesRead)
def remove_device_service(
    device_id: str,
    service_name: str,
    confirm: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeviceServicesRead:
    """Rimuove un servizio monitorato da un device (config YAML + DB)."""
    _require_admin(current_user)
    if not confirm:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Conferma richiesta: impostare confirm=true",
        )
    try:
        services = device_service.remove_monitored_service(db, device_id, service_name)
    except device_service.DeviceNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device non trovato") from exc
    except device_service.ServiceNotConfigured as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except device_service.InvalidServiceName as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return DeviceServicesRead(device_id=device_id, services=services)

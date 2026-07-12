"""Endpoint di scrittura sui luoghi (creazione, modifica, eliminazione).

Un luogo raggruppa uno o piu' device. Le operazioni modificano la config
`devices.yaml` (fonte di verita') e riallineano il DB. Protetto da JWT tramite
il router aggregato. L'eliminazione e' consentita solo per luoghi vuoti.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.luogo import LuogoCreate, LuogoRead, LuogoUpdate
from app.services import device_service

router = APIRouter(tags=["luoghi"])


def _to_luogo_read(luogo) -> LuogoRead:
    """Converte un modello Luogo in schema LuogoRead con conteggio device."""
    return LuogoRead(
        id=luogo.id,
        name=luogo.name,
        device_count=len(luogo.devices),
        display_order=luogo.display_order,
    )


@router.post(
    "/luoghi",
    response_model=LuogoRead,
    status_code=status.HTTP_201_CREATED,
)
def create_luogo(payload: LuogoCreate, db: Session = Depends(get_db)) -> LuogoRead:
    """Crea un nuovo luogo e lo persiste nella config YAML + DB."""
    try:
        luogo = device_service.create_luogo(db, payload)
    except device_service.DuplicateLuogo as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except device_service.InvalidLuogoData as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_luogo_read(luogo)


@router.put("/luoghi/{luogo_id}", response_model=LuogoRead)
def update_luogo(
    luogo_id: str, payload: LuogoUpdate, db: Session = Depends(get_db)
) -> LuogoRead:
    """Aggiorna nome/ordine di un luogo (config YAML + DB)."""
    try:
        luogo = device_service.update_luogo(db, luogo_id, payload)
    except device_service.LuogoNotFound as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Luogo non trovato"
        ) from exc
    except device_service.InvalidLuogoData as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_luogo_read(luogo)


@router.delete("/luoghi/{luogo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_luogo(luogo_id: str, db: Session = Depends(get_db)):
    """Elimina un luogo vuoto dalla config YAML e dal DB."""
    try:
        device_service.delete_luogo(db, luogo_id)
    except device_service.LuogoNotFound as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Luogo non trovato"
        ) from exc
    except device_service.LuogoNotEmpty as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Il luogo contiene ancora dei device: rimuovili prima.",
        ) from exc

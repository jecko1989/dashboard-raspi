"""Schemi Pydantic per i luoghi (raggruppamento di device)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class LuogoBase(BaseModel):
    id: str
    name: str


class LuogoRead(LuogoBase):
    model_config = ConfigDict(from_attributes=True)

    device_count: int = 0
    display_order: int = 0


class LuogoCreate(BaseModel):
    """Payload per la creazione di un nuovo luogo dalla dashboard.

    La validazione di formato e i duplicati sono verificati nel service
    (`device_service.create_luogo`).
    """

    id: str
    name: str
    display_order: int = 0


class LuogoUpdate(BaseModel):
    """Payload per la modifica di un luogo (l'id e' immutabile)."""

    name: str
    display_order: int | None = None

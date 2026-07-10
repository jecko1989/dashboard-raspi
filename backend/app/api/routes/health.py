"""Endpoint di health check."""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Ritorna lo stato di salute del backend."""
    return {"status": "ok"}

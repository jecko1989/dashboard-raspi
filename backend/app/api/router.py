"""Aggregazione dei router sotto il prefisso /api."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.api.routes import auth, commands, devices, health, monitoring, read, shell, ssh_keys

api_router = APIRouter(prefix="/api")

# Endpoint pubblici: health check e autenticazione.
api_router.include_router(health.router)
api_router.include_router(auth.router)

# Endpoint protetti: richiedono un JWT valido.
_protected = [Depends(get_current_user)]
api_router.include_router(read.router, dependencies=_protected)
api_router.include_router(devices.router, dependencies=_protected)
api_router.include_router(monitoring.router, dependencies=_protected)
api_router.include_router(commands.router, dependencies=_protected)
api_router.include_router(ssh_keys.router, dependencies=_protected)

# Shell web (WebSocket): l'autenticazione JWT admin e' gestita internamente
# alla route, poiche' i WebSocket browser non inviano l'header Bearer.
api_router.include_router(shell.router)

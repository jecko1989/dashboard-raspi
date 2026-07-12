"""Entry point dell'applicazione FastAPI.

Configura logging, CORS, inizializza il DB, sincronizza la config e monta i
router. Avvia lo scheduler in background.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.db.init_db import init_db
from app.db.session import SessionLocal
from app.scheduler.scheduler import start_scheduler, stop_scheduler
from app.services.device_service import sync_config_to_db
from app.services.user_service import bootstrap_admin

setup_logging()
logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo di vita dell'app: startup e shutdown."""
    logger.info("Avvio %s (env=%s)", settings.app_name, settings.environment)
    init_db()

    # Sincronizza luoghi/device dalla config al DB.
    db = SessionLocal()
    try:
        sync_config_to_db(db)
        bootstrap_admin(db)
    except Exception:
        logger.exception("Errore nella sincronizzazione della config all'avvio.")
    finally:
        db.close()

    start_scheduler()
    yield
    stop_scheduler()
    logger.info("Applicazione arrestata.")


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root() -> dict[str, str]:
    """Endpoint radice informativo."""
    return {"app": settings.app_name, "docs": "/docs", "health": "/api/health"}

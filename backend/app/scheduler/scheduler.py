"""Scheduler per la raccolta periodica delle metriche.

FASE 1: skeleton. Registra un job periodico che, per ora, esegue solo un
ciclo no-op loggato. La logica reale viene aggiunta in Fase 2/3.
"""
from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.services.metrics_service import run_collection_cycle

logger = get_logger(__name__)

_scheduler: BackgroundScheduler | None = None


def _collection_job() -> None:
    """Job eseguito periodicamente: apre una sessione DB e lancia il ciclo."""
    db = SessionLocal()
    try:
        run_collection_cycle(db)
    except Exception:  # pragma: no cover - difensivo
        logger.exception("Errore durante il ciclo di raccolta metriche.")
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    """Avvia lo scheduler in background."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    settings = get_settings()
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _collection_job,
        trigger="interval",
        seconds=settings.metrics_interval_seconds,
        id="metrics_collection",
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info(
        "Scheduler avviato (intervallo=%ds).", settings.metrics_interval_seconds
    )
    return _scheduler


def stop_scheduler() -> None:
    """Ferma lo scheduler se attivo."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Scheduler fermato.")

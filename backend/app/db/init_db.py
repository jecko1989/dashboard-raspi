"""Inizializzazione dello schema del database.

FASE 1: crea le tabelle con create_all(). In una fase successiva si potra'
introdurre Alembic per le migrazioni versionate. Nel frattempo, una piccola
migrazione additiva aggiunge le colonne mancanti su DB esistenti.
"""
from __future__ import annotations

from sqlalchemy import inspect, text

from app.core.logging import get_logger
from app.db.base import Base
from app.db.session import engine

# Import necessario affinche' i modelli vengano registrati su Base.metadata.
from app import models  # noqa: F401

logger = get_logger(__name__)


def _ensure_column(table: str, column: str, ddl_type: str) -> None:
    """Aggiunge una colonna se manca (migrazione additiva, SQLite/Postgres)."""
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns(table)}
    if column in existing:
        return
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
    logger.info("Migrazione: aggiunta colonna %s.%s", table, column)


def init_db() -> None:
    """Crea tutte le tabelle se non esistono e applica migrazioni additive."""
    logger.info("Inizializzazione schema database...")
    Base.metadata.create_all(bind=engine)
    # Colonne aggiunte dopo la Fase 1: ordine di visualizzazione.
    _ensure_column("apartments", "display_order", "INTEGER NOT NULL DEFAULT 0")
    _ensure_column("devices", "display_order", "INTEGER NOT NULL DEFAULT 0")
    logger.info("Schema database pronto.")

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


def _rename_table(old: str, new: str) -> None:
    """Rinomina una tabella se esiste ancora col vecchio nome (SQLite/Postgres)."""
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    if old not in tables or new in tables:
        return
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {old} RENAME TO {new}"))
    logger.info("Migrazione: rinominata tabella %s -> %s", old, new)


def _rename_column(table: str, old: str, new: str) -> None:
    """Rinomina una colonna se presente col vecchio nome (SQLite 3.25+/Postgres)."""
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return
    columns = {c["name"] for c in insp.get_columns(table)}
    if old not in columns or new in columns:
        return
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} RENAME COLUMN {old} TO {new}"))
    logger.info("Migrazione: rinominata colonna %s.%s -> %s", table, old, new)


def init_db() -> None:
    """Crea tutte le tabelle se non esistono e applica migrazioni additive."""
    logger.info("Inizializzazione schema database...")
    # Rename (v0.6.0): appartamento -> luogo. Va eseguito PRIMA di create_all,
    # altrimenti verrebbe creata una tabella 'luoghi' vuota accanto a 'apartments'.
    _rename_table("apartments", "luoghi")
    _rename_column("devices", "apartment_id", "luogo_id")
    Base.metadata.create_all(bind=engine)
    # Colonne aggiunte dopo la Fase 1: ordine di visualizzazione.
    _ensure_column("luoghi", "display_order", "INTEGER NOT NULL DEFAULT 0")
    _ensure_column("devices", "display_order", "INTEGER NOT NULL DEFAULT 0")
    # v0.6.0: tag del device persistiti in DB (JSON).
    _ensure_column("devices", "tags", "JSON NOT NULL DEFAULT '[]'")
    # v0.7.0: metriche ventola CPU (sistemi passivi supportati con valori null).
    _ensure_column("metrics", "fan_rpm", "REAL")
    _ensure_column("metrics", "fan_mode", "VARCHAR(32)")
    logger.info("Schema database pronto.")

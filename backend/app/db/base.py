"""Base dichiarativa SQLAlchemy per i modelli ORM."""
from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Classe base per tutti i modelli ORM."""

    pass

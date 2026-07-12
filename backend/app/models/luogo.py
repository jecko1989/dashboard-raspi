"""Modello ORM: luoghi (raggruppamento di device)."""
from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Luogo(Base):
    """Luogo che raggruppa uno o piu' Raspberry Pi."""

    __tablename__ = "luoghi"

    # Usa l'id logico da config (es. "casa_mia") come chiave primaria.
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    # Ordine di visualizzazione (crescente); a parita', ordine alfabetico per nome.
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    devices: Mapped[list["Device"]] = relationship(  # noqa: F821
        back_populates="luogo",
        cascade="all, delete-orphan",
    )

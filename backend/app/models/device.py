"""Modello ORM: dispositivi (Raspberry Pi)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Device(Base):
    """Raspberry Pi monitorato, associato a un luogo."""

    __tablename__ = "devices"

    # Id logico da config (es. "rpi-casa-mia-01").
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    hostname: Mapped[str] = mapped_column(String(128), nullable=False)
    ip_vpn: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Etichette libere del device (persistite come JSON, default lista vuota).
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    luogo_id: Mapped[str] = mapped_column(
        ForeignKey("luoghi.id"), index=True, nullable=False
    )
    # Ordine di visualizzazione dentro il luogo (crescente); a parita', per nome.
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Parametri SSH (nessuna password: solo path chiave).
    ssh_username: Mapped[str] = mapped_column(String(64), nullable=False)
    ssh_port: Mapped[int] = mapped_column(Integer, default=22, nullable=False)
    ssh_key_path: Mapped[str] = mapped_column(String(255), nullable=False)

    # Stato runtime.
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alerts_muted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Latenza dell'ultimo check TCP (millisecondi), None se non raggiungibile.
    last_latency_ms: Mapped[float | None] = mapped_column(nullable=True)
    # Contatore di check consecutivi falliti (per la logica offline).
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_metric_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    luogo: Mapped["Luogo"] = relationship(  # noqa: F821
        back_populates="devices"
    )

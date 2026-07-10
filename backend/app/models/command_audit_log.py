"""Modello ORM: audit log dei comandi remoti."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CommandAuditLog(Base):
    """Registro di ogni comando remoto tentato (reboot, shutdown, update, restart)."""

    __tablename__ = "command_audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(
        ForeignKey("devices.id"), index=True, nullable=False
    )
    # Utente che ha richiesto il comando (username). Nullable finche' auth non attiva.
    requested_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Es: "reboot", "shutdown", "update", "service_restart".
    command: Mapped[str] = mapped_column(String(64), nullable=False)
    # Dettaglio opzionale (es. nome servizio).
    target: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Es: "pending", "success", "error", "denied".
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    detail: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
    )

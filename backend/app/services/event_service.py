"""Servizio eventi: lettura, conteggio e cancellazione per scope."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, desc, func, select
from sqlalchemy.orm import Session

from app.models.device import Device
from app.models.event import Event


def _apply_scope_filters(stmt, device_id: str | None, luogo_id: str | None):
    if luogo_id:
        stmt = stmt.join(Device, Event.device_id == Device.id).where(Device.luogo_id == luogo_id)
    if device_id:
        stmt = stmt.where(Event.device_id == device_id)
    return stmt


def _apply_time_filter(stmt, since_hours: int | None):
    if since_hours and since_hours > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
        stmt = stmt.where(Event.created_at >= cutoff)
    return stmt


def list_events(
    db: Session,
    *,
    limit: int = 50,
    device_id: str | None = None,
    luogo_id: str | None = None,
    since_hours: int | None = None,
) -> list[Event]:
    """Ritorna gli eventi ordinati per data decrescente, con filtri opzionali."""
    safe_limit = max(1, min(limit, 500))
    stmt = select(Event)
    stmt = _apply_scope_filters(stmt, device_id, luogo_id)
    stmt = _apply_time_filter(stmt, since_hours)
    stmt = stmt.order_by(desc(Event.created_at)).limit(safe_limit)
    return list(db.scalars(stmt).all())


def count_events(
    db: Session,
    *,
    device_id: str | None = None,
    luogo_id: str | None = None,
    since_hours: int | None = None,
) -> int:
    """Conta gli eventi con filtri opzionali di scope e finestra temporale."""
    stmt = select(func.count(Event.id))
    stmt = _apply_scope_filters(stmt, device_id, luogo_id)
    stmt = _apply_time_filter(stmt, since_hours)
    total = db.scalar(stmt)
    return int(total or 0)


def delete_events(
    db: Session,
    *,
    device_id: str | None = None,
    luogo_id: str | None = None,
) -> int:
    """Cancella eventi per scope. Se nessun filtro e' presente, cancella tutti."""
    if luogo_id:
        device_ids = select(Device.id).where(Device.luogo_id == luogo_id)
        stmt = delete(Event).where(Event.device_id.in_(device_ids))
    elif device_id:
        stmt = delete(Event).where(Event.device_id == device_id)
    else:
        stmt = delete(Event)

    result = db.execute(stmt)
    db.commit()
    return int(result.rowcount or 0)

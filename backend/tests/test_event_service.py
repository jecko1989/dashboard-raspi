"""Test del servizio eventi (conteggio/lista/cancellazione per scope)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models  # noqa: F401 - registra i modelli su Base.metadata
from app.db.base import Base
from app.models.device import Device
from app.models.event import Event
from app.models.luogo import Luogo
from app.services import event_service


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


def _seed(db) -> None:
    db.add_all(
        [
            Luogo(id="casa", name="Casa", display_order=1),
            Luogo(id="ufficio", name="Ufficio", display_order=2),
            Device(
                id="rpi-casa-01",
                name="RPI Casa",
                hostname="rpi-casa-01",
                ip_vpn="100.64.0.10",
                luogo_id="casa",
                ssh_username="pi",
                ssh_port=22,
                ssh_key_path="/tmp/id_rpi_casa",
            ),
            Device(
                id="rpi-ufficio-01",
                name="RPI Ufficio",
                hostname="rpi-ufficio-01",
                ip_vpn="100.64.0.20",
                luogo_id="ufficio",
                ssh_username="pi",
                ssh_port=22,
                ssh_key_path="/tmp/id_rpi_ufficio",
            ),
        ]
    )

    now = datetime.now(timezone.utc)
    db.add_all(
        [
            Event(
                device_id="rpi-casa-01",
                type="status_change",
                message="Casa online",
                created_at=now - timedelta(hours=2),
            ),
            Event(
                device_id="rpi-casa-01",
                type="alert",
                message="CPU alta",
                created_at=now - timedelta(hours=26),
            ),
            Event(
                device_id="rpi-ufficio-01",
                type="status_change",
                message="Ufficio online",
                created_at=now - timedelta(hours=3),
            ),
            Event(
                device_id=None,
                type="system",
                message="Evento globale",
                created_at=now - timedelta(hours=1),
            ),
        ]
    )
    db.commit()


def test_count_events_last_24h(db) -> None:
    _seed(db)

    assert event_service.count_events(db, since_hours=24) == 3
    assert event_service.count_events(db, device_id="rpi-casa-01", since_hours=24) == 1
    assert event_service.count_events(db, luogo_id="casa", since_hours=24) == 1


def test_list_events_scope(db) -> None:
    _seed(db)

    all_events = event_service.list_events(db, limit=10)
    luogo_events = event_service.list_events(db, limit=10, luogo_id="casa")
    device_events = event_service.list_events(db, limit=10, device_id="rpi-casa-01")

    assert len(all_events) == 4
    assert len(luogo_events) == 2
    assert len(device_events) == 2


def test_delete_events_scope(db) -> None:
    _seed(db)

    deleted_luogo = event_service.delete_events(db, luogo_id="casa")
    assert deleted_luogo == 2
    assert event_service.count_events(db) == 2

    deleted_device = event_service.delete_events(db, device_id="rpi-ufficio-01")
    assert deleted_device == 1
    assert event_service.count_events(db) == 1

    deleted_all = event_service.delete_events(db)
    assert deleted_all == 1
    assert event_service.count_events(db) == 0

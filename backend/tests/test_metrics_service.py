"""Test del tracking offline_since su transizioni online/offline."""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models  # noqa: F401 - registra i modelli su Base.metadata
from app.db.base import Base
from app.models.device import Device
from app.models.luogo import Luogo
from app.services import metrics_service
from app.services.config_loader import DevicesConfig, Thresholds


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


@pytest.fixture()
def device(db):
    db.add(Luogo(id="casa_test", name="Casa Test"))
    dev = Device(
        id="rpi-test-01",
        name="Test",
        hostname="rpi-test",
        ip_vpn="100.64.0.1",
        luogo_id="casa_test",
        ssh_username="pi",
        ssh_key_path="/secrets/ssh/id_test",
        is_online=True,
    )
    db.add(dev)
    db.commit()
    db.refresh(dev)
    return dev


@pytest.fixture()
def config():
    return DevicesConfig(thresholds=Thresholds(offline_after_failures=1), luoghi=[])


def test_offline_since_impostato_al_primo_fallimento(db, device, config, monkeypatch):
    monkeypatch.setattr(metrics_service, "check_reachability", lambda d: (False, None))

    metrics_service.check_and_collect(db, device, config)

    assert device.is_online is False
    assert device.offline_since is not None


def test_offline_since_azzerato_al_ripristino(db, device, config, monkeypatch):
    monkeypatch.setattr(metrics_service, "check_reachability", lambda d: (False, None))
    metrics_service.check_and_collect(db, device, config)
    assert device.offline_since is not None

    monkeypatch.setattr(metrics_service, "check_reachability", lambda d: (True, 5.0))
    monkeypatch.setattr(metrics_service, "collect_metrics", lambda db, d: None)
    metrics_service.check_and_collect(db, device, config)

    assert device.is_online is True
    assert device.offline_since is None


def test_offline_since_resta_costante_su_fallimenti_ripetuti(db, device, config, monkeypatch):
    monkeypatch.setattr(metrics_service, "check_reachability", lambda d: (False, None))

    metrics_service.check_and_collect(db, device, config)
    first_offline_since = device.offline_since

    metrics_service.check_and_collect(db, device, config)

    assert device.offline_since == first_offline_since

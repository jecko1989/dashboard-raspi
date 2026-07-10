"""Servizio di sincronizzazione config -> database e query sui device.

FASE 1: sincronizza appartamenti e device dal file YAML al DB e fornisce
funzioni di lettura di base. Nessuna raccolta metriche reale ancora.
"""
from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.alert import Alert
from app.models.apartment import Apartment
from app.models.command_audit_log import CommandAuditLog
from app.models.device import Device
from app.models.event import Event
from app.models.metric import Metric
from app.services.config_loader import DevicesConfig, load_devices_config

logger = get_logger(__name__)


def sync_config_to_db(db: Session, config: DevicesConfig | None = None) -> None:
    """Crea/aggiorna appartamenti e device nel DB a partire dalla config YAML.

    Rimuove anche gli appartamenti/device non piu' presenti nella config
    (es. dopo un rename dell'id), insieme alle righe dipendenti dei device.
    """
    config = config or load_devices_config()

    for ap in config.apartments:
        apartment = db.get(Apartment, ap.id)
        if apartment is None:
            apartment = Apartment(id=ap.id, name=ap.name)
            db.add(apartment)
        else:
            apartment.name = ap.name
        apartment.display_order = ap.order

        for dev in ap.devices:
            device = db.get(Device, dev.id)
            if device is None:
                device = Device(id=dev.id)
                db.add(device)
            device.name = dev.name
            device.hostname = dev.hostname
            device.ip_vpn = dev.ip_vpn
            device.description = dev.description
            device.apartment_id = ap.id
            device.ssh_username = dev.ssh.username
            device.ssh_port = dev.ssh.port
            device.ssh_key_path = dev.ssh.key_path
            device.display_order = dev.order

    _prune_removed(db, config)

    db.commit()
    logger.info("Sincronizzazione config -> DB completata.")


def _prune_removed(db: Session, config: DevicesConfig) -> None:
    """Elimina appartamenti/device non piu' presenti nella config."""
    config_ap_ids = {ap.id for ap in config.apartments}
    config_dev_ids = {dev.id for ap in config.apartments for dev in ap.devices}

    # Device rimossi: elimina prima le righe dipendenti (nessuna FK cascade).
    for device in list(db.scalars(select(Device)).all()):
        if device.id not in config_dev_ids:
            for model in (Metric, Alert, Event, CommandAuditLog):
                db.execute(delete(model).where(model.device_id == device.id))
            db.delete(device)
            logger.info("Rimosso device non piu' in config: %s", device.id)

    # Appartamenti rimossi (ormai senza device di config).
    for apartment in list(db.scalars(select(Apartment)).all()):
        if apartment.id not in config_ap_ids:
            db.delete(apartment)
            logger.info("Rimosso appartamento non piu' in config: %s", apartment.id)


def get_apartments(db: Session) -> list[Apartment]:
    """Ritorna gli appartamenti ordinati per display_order, poi per nome."""
    return list(
        db.scalars(
            select(Apartment).order_by(Apartment.display_order, Apartment.name)
        ).all()
    )


def get_devices(db: Session, apartment_id: str | None = None) -> list[Device]:
    """Ritorna i device (opz. per appartamento), ordinati per display_order, poi nome."""
    stmt = select(Device)
    if apartment_id:
        stmt = stmt.where(Device.apartment_id == apartment_id)
    stmt = stmt.order_by(Device.display_order, Device.name)
    return list(db.scalars(stmt).all())


def get_device(db: Session, device_id: str) -> Device | None:
    """Ritorna un singolo device per id."""
    return db.get(Device, device_id)


def build_ssh_command(device: Device) -> str:
    """Costruisce il comando SSH pronto da copiare per un device."""
    return (
        f"ssh -i {device.ssh_key_path} -p {device.ssh_port} "
        f"{device.ssh_username}@{device.ip_vpn}"
    )

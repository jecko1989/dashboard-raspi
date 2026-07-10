"""Servizio di gestione degli alert.

Valuta le metriche rispetto alle soglie configurate e mantiene gli alert
"attivi" (non risolti) coerenti: crea un alert quando una soglia viene superata
e lo risolve automaticamente quando la condizione rientra.

Rispetta il flag `alerts_muted` del device: se attivo, non vengono creati nuovi
alert (gli alert gia' attivi possono comunque essere risolti).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.alert import Alert
from app.models.device import Device
from app.models.event import Event
from app.models.metric import Metric
from app.services.config_loader import Thresholds

logger = get_logger(__name__)

# Soglia (secondi) sotto la quale un alert di reboot resta "recente".
REBOOT_ALERT_TTL_SECONDS = 3600


def _active_alert(db: Session, device_id: str, alert_type: str) -> Alert | None:
    """Ritorna l'alert attivo (non risolto) di un certo tipo per il device."""
    return db.scalars(
        select(Alert).where(
            Alert.device_id == device_id,
            Alert.type == alert_type,
            Alert.is_resolved.is_(False),
        )
    ).first()


def raise_alert(
    db: Session, device: Device, alert_type: str, severity: str, message: str
) -> None:
    """Crea un alert se non ne esiste gia' uno attivo dello stesso tipo.

    Non fa nulla se gli alert del device sono silenziati (muted).
    """
    if device.alerts_muted:
        return
    if _active_alert(db, device.id, alert_type) is not None:
        return
    db.add(Alert(device_id=device.id, type=alert_type, severity=severity, message=message))
    db.add(Event(device_id=device.id, type="alert", message=message))
    logger.info("Alert [%s] su %s: %s", alert_type, device.id, message)


def resolve_alert(db: Session, device: Device, alert_type: str) -> None:
    """Risolve l'alert attivo di un certo tipo, se presente."""
    alert = _active_alert(db, device.id, alert_type)
    if alert is None:
        return
    alert.is_resolved = True
    alert.resolved_at = datetime.now(timezone.utc)
    db.add(Event(device_id=device.id, type="alert", message=f"Risolto: {alert_type}"))
    logger.info("Alert [%s] risolto su %s.", alert_type, device.id)


def _check_threshold(
    db: Session,
    device: Device,
    alert_type: str,
    value: float | None,
    limit: float,
    label: str,
    unit: str,
    severity: str = "warning",
) -> None:
    """Crea o risolve un alert confrontando un valore con la sua soglia."""
    if value is None:
        return
    if value > limit:
        raise_alert(
            db,
            device,
            alert_type,
            severity,
            f"{label} a {value}{unit} (soglia {limit}{unit})",
        )
    else:
        resolve_alert(db, device, alert_type)


def evaluate_metric_alerts(
    db: Session, device: Device, metric: Metric, thresholds: Thresholds
) -> None:
    """Valuta gli alert di soglia (CPU, RAM, disco, temperatura) per una metrica."""
    _check_threshold(
        db, device, "cpu", metric.cpu_percent, thresholds.cpu_percent, "CPU", "%"
    )
    _check_threshold(
        db, device, "ram", metric.ram_percent, thresholds.ram_percent, "RAM", "%"
    )
    _check_threshold(
        db, device, "disk", metric.disk_percent, thresholds.disk_percent, "Disco", "%"
    )
    _check_threshold(
        db,
        device,
        "temperature",
        metric.temperature_celsius,
        thresholds.temperature_celsius,
        "Temperatura",
        "°C",
        severity="critical",
    )

    # Alert di reboot recente: si risolve quando l'uptime supera il TTL.
    if metric.uptime_seconds is not None and metric.uptime_seconds > REBOOT_ALERT_TTL_SECONDS:
        resolve_alert(db, device, "reboot")


def evaluate_offline_alert(db: Session, device: Device) -> None:
    """Crea o risolve l'alert di offline in base allo stato corrente del device."""
    if device.is_online:
        resolve_alert(db, device, "offline")
    else:
        raise_alert(db, device, "offline", "critical", "Device offline")


def detect_reboot(db: Session, device: Device, current: Metric) -> None:
    """Rileva un reboot confrontando l'uptime con la metrica precedente.

    Se l'uptime e' diminuito, il device e' stato riavviato: registra un evento e
    un alert di reboot.
    """
    if current.uptime_seconds is None:
        return
    previous = db.scalars(
        select(Metric)
        .where(Metric.device_id == device.id, Metric.id != current.id)
        .order_by(Metric.collected_at.desc())
        .limit(1)
    ).first()
    if previous is None or previous.uptime_seconds is None:
        return
    # Tolleranza per evitare falsi positivi da piccole discrepanze.
    if current.uptime_seconds + 60 < previous.uptime_seconds:
        db.add(Event(device_id=device.id, type="reboot", message="Reboot rilevato"))
        raise_alert(db, device, "reboot", "info", "Reboot recente rilevato")

"""Servizio di monitoraggio: reachability TCP e raccolta metriche via SSH.

FASE 2 (MVP): verifica lo stato online/offline via check TCP sulla porta SSH,
misura la latenza, e raccoglie metriche base via SSH usando l'allowlist.
"""
from __future__ import annotations

import socket
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.device import Device
from app.models.event import Event
from app.models.metric import Metric
from app.services import alerts_service
from app.services import metric_parsers as parsers
from app.services.config_loader import (
    DevicesConfig,
    load_devices_config,
    resolve_thresholds,
)
from app.ssh import allowlist
from app.ssh.client import SSHClient, SSHError, SSHResult, SSHTarget

logger = get_logger(__name__)


def check_reachability(device: Device) -> tuple[bool, float | None]:
    """Verifica la raggiungibilita' via check TCP sulla porta SSH.

    Ritorna (raggiungibile, latenza_ms). La latenza e' None se non raggiungibile.
    """
    from app.core.config import get_settings

    timeout = get_settings().ssh_connect_timeout
    start = time.perf_counter()
    try:
        with socket.create_connection((device.ip_vpn, device.ssh_port), timeout=timeout):
            latency_ms = round((time.perf_counter() - start) * 1000.0, 1)
            return True, latency_ms
    except OSError:
        return False, None


def _build_target(device: Device) -> SSHTarget:
    return SSHTarget(
        host=device.ip_vpn,
        port=device.ssh_port,
        username=device.ssh_username,
        key_path=device.ssh_key_path,
    )


def _text(results: dict[str, SSHResult], key: str) -> str:
    result = results.get(key)
    return result.stdout if result else ""


def collect_metrics(db: Session, device: Device) -> Metric | None:
    """Raccoglie le metriche base via SSH e le salva nel DB.

    Ritorna la Metric creata, oppure None se la connessione SSH fallisce.
    """
    client = SSHClient(_build_target(device))
    try:
        results = client.run_many(allowlist.READONLY_COMMANDS)
    except SSHError as exc:
        logger.warning("Raccolta metriche fallita per %s: %s", device.id, exc)
        return None

    metric = Metric(
        device_id=device.id,
        cpu_percent=parsers.parse_cpu_percent(_text(results, "cpu")),
        ram_percent=parsers.parse_ram_percent(_text(results, "memory")),
        disk_percent=parsers.parse_disk_percent(_text(results, "disk")),
        temperature_celsius=parsers.parse_temperature(_text(results, "temperature")),
        uptime_seconds=parsers.parse_uptime_seconds(_text(results, "uptime")),
        load_average_1m=parsers.parse_load_average_1m(_text(results, "loadavg")),
        fan_rpm=parsers.parse_fan_rpm(_text(results, "fan_rpm")),
        fan_mode=parsers.parse_fan_mode(_text(results, "fan_mode")),
        os_version=parsers.parse_os_version(_text(results, "os_version")),
        kernel=parsers.parse_kernel(_text(results, "kernel")),
    )
    db.add(metric)
    device.last_metric_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(metric)
    # Rileva eventuali reboot confrontando con la metrica precedente.
    alerts_service.detect_reboot(db, device, metric)
    db.commit()
    logger.info("Metriche raccolte per %s.", device.id)
    return metric


def check_and_collect(db: Session, device: Device, config: DevicesConfig) -> None:
    """Esegue check reachability + (se online) raccolta metriche per un device.

    Aggiorna stato online/offline, latenza, contatore fallimenti, registra un
    evento sul cambio di stato e valuta gli alert (offline + soglie metriche).
    """
    thresholds = resolve_thresholds(config, device.id)
    reachable, latency_ms = check_reachability(device)
    now = datetime.now(timezone.utc)
    previous_online = device.is_online

    device.last_checked_at = now
    device.last_latency_ms = latency_ms

    if reachable:
        device.consecutive_failures = 0
        device.is_online = True
    else:
        device.consecutive_failures += 1
        # Diventa offline solo dopo N fallimenti consecutivi.
        if device.consecutive_failures >= thresholds.offline_after_failures:
            device.is_online = False

    # Registra il cambio di stato come evento.
    if device.is_online != previous_online:
        state = "online" if device.is_online else "offline"
        db.add(Event(device_id=device.id, type="status_change", message=f"Device {state}"))

    # Alert offline/online.
    alerts_service.evaluate_offline_alert(db, device)
    db.commit()

    if device.is_online:
        metric = collect_metrics(db, device)
        if metric is not None:
            alerts_service.evaluate_metric_alerts(db, device, metric, thresholds)
            db.commit()


def run_collection_cycle(db: Session) -> None:
    """Esegue un ciclo completo di monitoraggio su tutti i device."""
    config = load_devices_config()
    devices = list(db.scalars(select(Device)).all())
    logger.info("Ciclo di monitoraggio su %d device.", len(devices))
    for device in devices:
        try:
            check_and_collect(db, device, config)
        except Exception:  # pragma: no cover - difensivo per singolo device
            logger.exception("Errore nel monitoraggio del device %s.", device.id)
            db.rollback()

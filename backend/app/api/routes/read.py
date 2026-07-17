"""Endpoint read-only (sola lettura).

Separati dagli endpoint di comando per policy di sicurezza.
FASE 1: ritornano dati sincronizzati dalla config; le metriche sono ancora vuote.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import asc, desc, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.metric import Metric
from app.schemas.alert import AlertRead, EventCountRead, EventRead
from app.schemas.command import CommandAuditRead, ServiceLogs, ServiceStatus
from app.schemas.device import DeviceRead
from app.schemas.luogo import LuogoRead
from app.schemas.metric import MetricRead
from app.services import device_service, event_service

router = APIRouter(tags=["read"])


def _to_device_read(device) -> DeviceRead:
    """Converte un modello Device in schema DeviceRead con comando SSH pronto."""
    data = DeviceRead.model_validate(device)
    data.ssh_command = device_service.build_ssh_command(device)
    return data


@router.get("/luoghi", response_model=list[LuogoRead])
def list_luoghi(db: Session = Depends(get_db)) -> list[LuogoRead]:
    luoghi = device_service.get_luoghi(db)
    return [
        LuogoRead(
            id=lg.id,
            name=lg.name,
            device_count=len(lg.devices),
            display_order=lg.display_order,
        )
        for lg in luoghi
    ]


@router.get("/devices", response_model=list[DeviceRead])
def list_devices(
    luogo_id: str | None = None, db: Session = Depends(get_db)
) -> list[DeviceRead]:
    devices = device_service.get_devices(db, luogo_id=luogo_id)
    return [_to_device_read(d) for d in devices]


@router.get("/devices/{device_id}", response_model=DeviceRead)
def get_device(device_id: str, db: Session = Depends(get_db)) -> DeviceRead:
    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device non trovato")
    return _to_device_read(device)


@router.get("/devices/{device_id}/metrics/latest", response_model=MetricRead | None)
def latest_metric(device_id: str, db: Session = Depends(get_db)) -> MetricRead | None:
    metric = db.scalars(
        select(Metric)
        .where(Metric.device_id == device_id)
        .order_by(desc(Metric.collected_at))
        .limit(1)
    ).first()
    return MetricRead.model_validate(metric) if metric else None


@router.get("/devices/{device_id}/metrics/history", response_model=list[MetricRead])
def metric_history(
    device_id: str, limit: int = 100, db: Session = Depends(get_db)
) -> list[MetricRead]:
    limit = max(1, min(limit, 1000))
    metrics = db.scalars(
        select(Metric)
        .where(Metric.device_id == device_id)
        .order_by(desc(Metric.collected_at))
        .limit(limit)
    ).all()
    return [MetricRead.model_validate(m) for m in reversed(list(metrics))]


@router.get("/devices/{device_id}/metrics/export.csv")
def export_metrics_csv(
    device_id: str, limit: int = 1000, db: Session = Depends(get_db)
) -> Response:
    """Esporta lo storico metriche di un device in formato CSV."""
    import csv
    import io

    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device non trovato")

    limit = max(1, min(limit, 10000))
    metrics = db.scalars(
        select(Metric)
        .where(Metric.device_id == device_id)
        .order_by(asc(Metric.collected_at))
        .limit(limit)
    ).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "collected_at",
            "cpu_percent",
            "ram_percent",
            "disk_percent",
            "temperature_celsius",
            "load_average_1m",
            "uptime_seconds",
            "fan_rpm",
            "fan_mode",
            "os_version",
            "kernel",
        ]
    )
    for m in metrics:
        writer.writerow(
            [
                m.collected_at.isoformat(),
                m.cpu_percent,
                m.ram_percent,
                m.disk_percent,
                m.temperature_celsius,
                m.load_average_1m,
                m.uptime_seconds,
                m.fan_rpm,
                m.fan_mode or "",
                m.os_version or "",
                m.kernel or "",
            ]
        )

    filename = f"{device_id}_metrics.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/devices/{device_id}/services", response_model=list[ServiceStatus])
def device_services(device_id: str, db: Session = Depends(get_db)) -> list[ServiceStatus]:
    """Ritorna lo stato (attivo/non attivo) dei servizi configurati per il device.

    Operazione read-only: interroga systemctl is-active via SSH senza modifiche.
    """
    from app.services import command_service
    from app.services.command_service import CommandError
    from app.services.config_loader import get_device_config, load_devices_config
    from app.ssh.client import SSHError

    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device non trovato")

    config = load_devices_config()
    dev_cfg = get_device_config(config, device_id)
    services = dev_cfg.services if dev_cfg else []

    result: list[ServiceStatus] = []
    for name in services:
        try:
            ssh_result = command_service.run_readonly(
                db, device, "service_status", service=name
            )
            state = ssh_result.stdout.strip() or "unknown"
            result.append(ServiceStatus(name=name, active=(state == "active"), status=state))
        except (SSHError, CommandError) as exc:
            result.append(ServiceStatus(name=name, active=False, status=f"errore: {exc}"))
    return result


@router.get("/devices/{device_id}/services/{service_name}/logs", response_model=ServiceLogs)
def service_logs(
    device_id: str, service_name: str, db: Session = Depends(get_db)
) -> ServiceLogs:
    """Ritorna gli ultimi log systemd di un servizio (read-only via journalctl)."""
    from app.services import command_service
    from app.services.command_service import CommandError
    from app.ssh.client import SSHError

    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device non trovato")

    try:
        ssh_result = command_service.run_readonly(
            db, device, "service_logs", service=service_name
        )
    except CommandError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SSHError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    logs = ssh_result.stdout or ssh_result.stderr
    return ServiceLogs(service=service_name, logs=logs)


@router.get("/devices/{device_id}/services/available", response_model=list[str])
def available_services(device_id: str, db: Session = Depends(get_db)) -> list[str]:
    """Ritorna i servizi systemd disponibili sul device (unit-file *.service)."""
    from app.services import command_service
    from app.services.command_service import CommandError
    from app.ssh.client import SSHError

    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device non trovato")

    try:
        ssh_result = command_service.run_readonly(db, device, "service_list")
    except CommandError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SSHError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    names: list[str] = []
    for line in (ssh_result.stdout or "").splitlines():
        value = line.strip()
        if not value:
            continue
        unit = value.split()[0]
        if unit.endswith(".service"):
            names.append(unit)

    # Rimuove duplicati mantenendo ordine stabile.
    return list(dict.fromkeys(names))


@router.get("/alerts", response_model=list[AlertRead])
def list_alerts(
    active_only: bool = True, db: Session = Depends(get_db)
) -> list[AlertRead]:
    from app.models.alert import Alert

    stmt = select(Alert).order_by(desc(Alert.created_at))
    if active_only:
        stmt = stmt.where(Alert.is_resolved.is_(False))
    alerts = db.scalars(stmt.limit(200)).all()
    return [AlertRead.model_validate(a) for a in alerts]


@router.get("/events", response_model=list[EventRead])
def list_events(
    limit: int = 50,
    device_id: str | None = None,
    luogo_id: str | None = None,
    since_hours: int | None = None,
    db: Session = Depends(get_db),
) -> list[EventRead]:
    if device_id and luogo_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Specificare solo uno tra device_id e luogo_id",
        )
    events = event_service.list_events(
        db,
        limit=limit,
        device_id=device_id,
        luogo_id=luogo_id,
        since_hours=since_hours,
    )
    return [EventRead.model_validate(e) for e in events]


@router.get("/events/count", response_model=EventCountRead)
def count_events(
    device_id: str | None = None,
    luogo_id: str | None = None,
    since_hours: int | None = 24,
    db: Session = Depends(get_db),
) -> EventCountRead:
    if device_id and luogo_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Specificare solo uno tra device_id e luogo_id",
        )
    total = event_service.count_events(
        db,
        device_id=device_id,
        luogo_id=luogo_id,
        since_hours=since_hours,
    )
    return EventCountRead(count=total)


@router.get("/audit", response_model=list[CommandAuditRead])
def list_audit(
    device_id: str | None = None, limit: int = 100, db: Session = Depends(get_db)
) -> list[CommandAuditRead]:
    """Ritorna l'audit log dei comandi remoti (opzionalmente filtrato per device)."""
    from app.models.command_audit_log import CommandAuditLog

    limit = max(1, min(limit, 500))
    stmt = select(CommandAuditLog).order_by(desc(CommandAuditLog.created_at))
    if device_id:
        stmt = stmt.where(CommandAuditLog.device_id == device_id)
    rows = db.scalars(stmt.limit(limit)).all()
    return [CommandAuditRead.model_validate(r) for r in rows]

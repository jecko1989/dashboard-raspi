"""Registro dei modelli ORM.

L'import di tutti i modelli qui garantisce che vengano registrati su
Base.metadata prima di create_all().
"""
from app.models.alert import Alert
from app.models.apartment import Apartment
from app.models.command_audit_log import CommandAuditLog
from app.models.device import Device
from app.models.event import Event
from app.models.metric import Metric
from app.models.user import User

__all__ = [
    "Alert",
    "Apartment",
    "CommandAuditLog",
    "Device",
    "Event",
    "Metric",
    "User",
]

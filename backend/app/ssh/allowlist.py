"""Allowlist esplicita dei comandi remoti consentiti.

SICUREZZA: nessun comando arbitrario viene mai eseguito sui Raspberry.
Solo i comandi definiti qui (o costruiti dalle factory) sono ammessi.
I comandi con privilegi elevati assumono una configurazione sudoers
NOPASSWD ristretta sul Raspberry (documentata nel README).
"""
from __future__ import annotations

# Comandi read-only per la raccolta metriche (nessun sudo richiesto).
READONLY_COMMANDS: dict[str, str] = {
    "cpu": "top -bn1 | grep 'Cpu(s)'",
    "memory": "free -b",
    "disk": "df -B1 /",
    "temperature": "cat /sys/class/thermal/thermal_zone0/temp",
    "uptime": "cat /proc/uptime",
    "loadavg": "cat /proc/loadavg",
    "os_version": "cat /etc/os-release",
    "kernel": "uname -r",
    # Rilevamento rete per l'annuncio delle subnet route Tailscale.
    "default_iface": "ip -o -4 route show default",
    "lan_routes": "ip -o -4 route show scope link",
}

# Comandi privilegiati consentiti. Richiedono sudoers NOPASSWD ristretto.
# I placeholder {service} vengono sostituiti solo con nomi validati.
PRIVILEGED_COMMANDS: dict[str, str] = {
    "reboot": "sudo /sbin/reboot",
    "shutdown": "sudo /sbin/shutdown -h now",
    "update_check": "sudo /usr/bin/apt-get update",
    "update_upgrade": "sudo /usr/bin/apt-get -y upgrade",
    # Simulazione (dry-run): non installa nulla, mostra cosa verrebbe aggiornato.
    "update_dry_run": "sudo /usr/bin/apt-get -s upgrade",
    "service_restart": "sudo /bin/systemctl restart {service}",
    "service_status": "/bin/systemctl is-active {service}",
    "service_logs": "/bin/journalctl -u {service} -n 100 --no-pager",
    # Tailscale: annuncio exit node e/o subnet route. {subnet} e' un CIDR validato.
    "tailscale_exit_node": "sudo /usr/bin/tailscale set --advertise-exit-node",
    "tailscale_routes": "sudo /usr/bin/tailscale set --advertise-routes={subnet}",
    "tailscale_exit_and_routes": (
        "sudo /usr/bin/tailscale set --advertise-exit-node --advertise-routes={subnet}"
    ),
    # Nodo Mysterium (myst): avvio/arresto del servizio systemd.
    # L'installazione nativa crea il servizio "mysterium-node".
    "myst_start": "sudo /bin/systemctl start mysterium-node",
    "myst_stop": "sudo /bin/systemctl stop mysterium-node",
    "myst_restart": "sudo /bin/systemctl restart mysterium-node",
    # Backup/restore del nodo Mysterium. La data-dir nativa è /var/lib/mysterium-node
    # (contiene keystore/ con l'identità del nodo). Stream binario via SSH.
    "myst_backup": "sudo /usr/bin/tar -czf - -C /var/lib/mysterium-node .",
    "myst_restore": "sudo /usr/bin/tar -xzf - -C /var/lib/mysterium-node",
    "myst_chown": "sudo /usr/bin/chown -R mysterium-node /var/lib/mysterium-node",
}


def is_allowed(command_key: str) -> bool:
    """Ritorna True se il comando e' presente nell'allowlist."""
    return command_key in READONLY_COMMANDS or command_key in PRIVILEGED_COMMANDS


def is_valid_service_name(name: str) -> bool:
    """Valida un nome di servizio systemd per prevenire command injection."""
    import re

    # Consente lettere, numeri, punto, trattino, underscore, @ e :.
    return bool(re.fullmatch(r"[A-Za-z0-9._@:-]{1,128}", name))


def is_valid_cidr(value: str) -> bool:
    """Valida una subnet IPv4/IPv6 in notazione CIDR (es. 192.168.1.0/24)."""
    import ipaddress

    try:
        ipaddress.ip_network(value, strict=True)
        return True
    except ValueError:
        return False

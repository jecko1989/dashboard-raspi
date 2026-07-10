"""Generazione di coppie di chiavi SSH per i device.

Genera una coppia Ed25519 in formato OpenSSH. La chiave PRIVATA viene salvata
(se possibile) nel percorso configurato per il device (`ssh_key_path`) con
permessi ristretti; la chiave PUBBLICA va installata sul Raspberry
(`~/.ssh/authorized_keys`), tipicamente con `ssh-copy-id`.

Nota: in Docker la cartella `secrets/ssh` è montata in sola lettura, quindi il
salvataggio su disco può fallire: in quel caso la chiave privata viene
restituita nella risposta perché l'utente la salvi manualmente.
"""
from __future__ import annotations

import os
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.core.logging import get_logger
from app.models.device import Device

logger = get_logger(__name__)


class SSHKeyError(Exception):
    """Errore nella generazione o nel salvataggio della chiave."""


def generate_keypair(comment: str) -> tuple[str, str]:
    """Genera una coppia Ed25519 in formato OpenSSH: (privata, pubblica)."""
    key = Ed25519PrivateKey.generate()
    private_str = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.OpenSSH,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_body = key.public_key().public_bytes(
        encoding=serialization.Encoding.OpenSSH,
        format=serialization.PublicFormat.OpenSSH,
    ).decode("utf-8")
    public_str = f"{public_body} {comment}\n"
    return private_str, public_str


def _save_keypair(
    key_path: str, private_str: str, public_str: str, force: bool
) -> tuple[bool, str | None]:
    """Salva la coppia su disco. Ritorna (salvata, motivo_fallimento)."""
    priv = Path(key_path)
    pub = Path(f"{key_path}.pub")
    if priv.exists() and not force:
        raise SSHKeyError(
            "Esiste già una chiave in questo percorso. "
            "Sovrascriverla romperebbe l'accesso attuale: usa force=true per procedere."
        )
    try:
        priv.parent.mkdir(parents=True, exist_ok=True)
        priv.write_text(private_str, encoding="utf-8")
        os.chmod(priv, 0o600)
        pub.write_text(public_str, encoding="utf-8")
        os.chmod(pub, 0o644)
        return True, None
    except OSError as exc:
        # Tipico in Docker: secrets/ssh montata in sola lettura.
        logger.warning("Impossibile salvare la chiave in %s: %s", key_path, exc)
        return False, str(exc)


def build_install_command(device: Device) -> str:
    """Comando ssh-copy-id pronto per installare la chiave pubblica sul Pi."""
    port = f"-p {device.ssh_port} " if device.ssh_port and device.ssh_port != 22 else ""
    return (
        f"ssh-copy-id {port}-i {device.ssh_key_path}.pub "
        f"{device.ssh_username}@{device.ip_vpn}"
    )


def create_device_key(device: Device, force: bool = False) -> dict:
    """Genera (ed eventualmente salva) la chiave per il device.

    Ritorna un dizionario con i campi dello schema `SSHKeyResult`. La chiave
    privata è inclusa SOLO se non è stato possibile salvarla su disco.
    """
    private_str, public_str = generate_keypair(comment=f"dashboard-{device.id}")
    saved, failure = _save_keypair(device.ssh_key_path, private_str, public_str, force)

    detail = (
        f"Chiave salvata in {device.ssh_key_path} (privata) e "
        f"{device.ssh_key_path}.pub (pubblica)."
        if saved
        else (
            "Non è stato possibile salvare la chiave su disco "
            f"({failure}). Salvala manualmente nel percorso {device.ssh_key_path}."
        )
    )
    return {
        "device_id": device.id,
        "public_key": public_str.strip(),
        "key_path": device.ssh_key_path,
        "saved": saved,
        "private_key": None if saved else private_str,
        "install_command": build_install_command(device),
        "manual_hint": (
            "In alternativa, sul Raspberry: "
            "mkdir -p ~/.ssh && chmod 700 ~/.ssh && "
            "echo '<chiave-pubblica>' >> ~/.ssh/authorized_keys && "
            "chmod 600 ~/.ssh/authorized_keys"
        ),
        "detail": detail,
    }

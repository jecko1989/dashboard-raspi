"""Client SSH basato su Paramiko.

Usa SOLO autenticazione a chiave: nessuna password viene mai gestita o
memorizzata. Supporta l'esecuzione di piu' comandi su un'unica connessione
per efficienza durante la raccolta metriche.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

import paramiko

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SSHError(Exception):
    """Errore generico durante l'operazione SSH."""


@dataclass
class SSHResult:
    """Risultato dell'esecuzione di un comando remoto."""

    exit_code: int
    stdout: str
    stderr: str

    @property
    def ok(self) -> bool:
        return self.exit_code == 0


@dataclass
class SSHTarget:
    """Parametri di connessione a un Raspberry."""

    host: str
    port: int
    username: str
    key_path: str


class SSHClient:
    """Wrapper minimale attorno a Paramiko per eseguire comandi via chiave SSH."""

    def __init__(self, target: SSHTarget, timeout: float | None = None) -> None:
        settings = get_settings()
        self.target = target
        self.timeout = timeout if timeout is not None else settings.ssh_connect_timeout
        self._settings = settings

    def _build_client(self) -> paramiko.SSHClient:
        """Crea e connette un client Paramiko applicando la host key policy."""
        if not os.path.exists(self.target.key_path):
            raise SSHError(
                f"Chiave SSH non trovata: {self.target.key_path}. "
                "Controlla il volume secrets/ssh e i key_path in devices.yaml."
            )

        client = paramiko.SSHClient()

        known_hosts = self._settings.ssh_known_hosts_path
        if known_hosts and os.path.exists(known_hosts):
            client.load_host_keys(known_hosts)
            client.set_missing_host_key_policy(paramiko.RejectPolicy())
        elif self._settings.ssh_auto_add_host_keys:
            # TOFU: accettabile su VPN privata per l'MVP. Vedi README per hardening.
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        else:
            client.set_missing_host_key_policy(paramiko.RejectPolicy())

        try:
            client.connect(
                hostname=self.target.host,
                port=self.target.port,
                username=self.target.username,
                key_filename=self.target.key_path,
                timeout=self.timeout,
                banner_timeout=self.timeout,
                auth_timeout=self.timeout,
                allow_agent=False,
                look_for_keys=False,
            )
        except Exception as exc:  # paramiko/socket errors
            raise SSHError(
                f"Connessione SSH fallita verso {self.target.host}: {exc}"
            ) from exc

        return client

    @staticmethod
    def _exec(client: paramiko.SSHClient, command: str) -> SSHResult:
        _stdin, stdout, stderr = client.exec_command(command)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        return SSHResult(exit_code=exit_code, stdout=out, stderr=err)

    def run(self, command: str) -> SSHResult:
        """Esegue un singolo comando sul device remoto."""
        client = self._build_client()
        try:
            return self._exec(client, command)
        finally:
            client.close()

    def run_many(self, commands: dict[str, str]) -> dict[str, SSHResult]:
        """Esegue piu' comandi su un'unica connessione. Ritorna {chiave: risultato}."""
        client = self._build_client()
        results: dict[str, SSHResult] = {}
        try:
            for key, command in commands.items():
                try:
                    results[key] = self._exec(client, command)
                except Exception as exc:  # comando singolo fallito
                    logger.warning(
                        "Comando '%s' fallito su %s: %s", key, self.target.host, exc
                    )
                    results[key] = SSHResult(exit_code=-1, stdout="", stderr=str(exc))
            return results
        finally:
            client.close()

    def run_binary(self, command: str, allow_exit_codes: tuple[int, ...] = (0,)) -> bytes:
        """Esegue un comando e ritorna lo stdout GREZZO (bytes).

        Utile per stream binari (es. `tar -czf -`). Solleva SSHError se il
        comando termina con un exit code non incluso in `allow_exit_codes`.
        Lo stdout viene letto per intero PRIMA di controllare l'exit code, quindi
        i byte sono integri anche per gli exit code tollerati (es. tar exit=1,
        "file changed as we read it": l'archivio e' comunque valido).
        """
        client = self._build_client()
        try:
            stdin, stdout, stderr = client.exec_command(command)
            stdin.close()
            data = stdout.read()  # bytes fino a EOF
            exit_code = stdout.channel.recv_exit_status()
            if exit_code not in allow_exit_codes:
                err = stderr.read().decode("utf-8", errors="replace")
                raise SSHError(
                    f"Comando fallito su {self.target.host} (exit={exit_code}): "
                    f"{err.strip()}"
                )
            if exit_code != 0:
                err = stderr.read().decode("utf-8", errors="replace")
                logger.warning(
                    "Comando su %s terminato con exit=%d (tollerato): %s",
                    self.target.host,
                    exit_code,
                    err.strip(),
                )
            return data
        finally:
            client.close()

    def run_with_input(self, command: str, data: bytes) -> SSHResult:
        """Esegue un comando inviando `data` (bytes) sullo stdin remoto.

        Utile per lo stream in ingresso (es. `tar -xzf -`).
        """
        client = self._build_client()
        try:
            stdin, stdout, stderr = client.exec_command(command)
            view = memoryview(data)
            chunk = 32768
            for i in range(0, len(view), chunk):
                stdin.write(view[i : i + chunk])
            stdin.flush()
            stdin.channel.shutdown_write()
            exit_code = stdout.channel.recv_exit_status()
            out = stdout.read().decode("utf-8", errors="replace")
            err = stderr.read().decode("utf-8", errors="replace")
            return SSHResult(exit_code=exit_code, stdout=out, stderr=err)
        finally:
            client.close()

    def open_shell(
        self, term: str = "xterm-256color", cols: int = 80, rows: int = 24
    ) -> tuple[paramiko.SSHClient, paramiko.Channel]:
        """Apre una shell interattiva con PTY e ritorna (client, channel).

        A differenza degli altri metodi, la connessione NON viene chiusa qui:
        il chiamante (shell_service) e' responsabile del ciclo di vita del
        canale e della chiusura del client tramite `close_shell`.

        SICUREZZA: questo canale consente comandi arbitrari sul device, quindi
        l'endpoint che lo usa deve essere riservato agli admin e sottoposto ad
        audit (vedi shell_service).
        """
        client = self._build_client()
        try:
            channel = client.invoke_shell(term=term, width=cols, height=rows)
            return client, channel
        except Exception as exc:  # paramiko/socket errors
            client.close()
            raise SSHError(
                f"Apertura shell SSH fallita verso {self.target.host}: {exc}"
            ) from exc

    @staticmethod
    def close_shell(client: paramiko.SSHClient, channel: paramiko.Channel) -> None:
        """Chiude in sicurezza canale e connessione di una shell interattiva."""
        try:
            channel.close()
        except Exception:  # noqa: BLE001 - best effort
            pass
        try:
            client.close()
        except Exception:  # noqa: BLE001 - best effort
            pass

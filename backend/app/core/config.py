"""Configurazione applicativa caricata da variabili d'ambiente.

Usa pydantic-settings per validare e tipizzare le impostazioni.
Le stesse variabili sono documentate in `.env.example`.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Impostazioni globali dell'applicazione."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Applicazione
    app_name: str = Field(default="Raspberry Dashboard")
    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")

    # Database
    database_url: str = Field(default="sqlite:////data/raspberry_dashboard.db")

    # SSH / configurazione device
    ssh_keys_dir: str = Field(default="/secrets/ssh")
    devices_config_path: str = Field(default="/config/devices.yaml")
    # Timeout (secondi) per connessione TCP/SSH.
    ssh_connect_timeout: float = Field(default=8.0)
    # Path opzionale a un file known_hosts. Se presente, l'host key viene verificato.
    ssh_known_hosts_path: str = Field(default="")
    # Se True e known_hosts non e' disponibile, aggiunge automaticamente l'host key
    # (TOFU). Comodo per MVP su VPN privata; disattivare in ambienti piu' esposti.
    ssh_auto_add_host_keys: bool = Field(default=True)

    # Auth (placeholder in Fase 1, usato nelle fasi successive)
    jwt_secret_key: str = Field(default="CHANGE_ME")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expire_minutes: int = Field(default=60)
    admin_username: str = Field(default="admin")
    admin_password: str = Field(default="CHANGE_ME")

    # CORS
    cors_origins: str = Field(default="http://localhost:5173")

    # Scheduler
    metrics_interval_seconds: int = Field(default=60)

    # Rate limiting endpoint di comando (richieste al minuto per client IP).
    command_rate_limit_per_minute: int = Field(default=10)

    @property
    def cors_origins_list(self) -> list[str]:
        """Ritorna le origini CORS come lista."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Ritorna un'istanza cache-ata delle impostazioni."""
    return Settings()

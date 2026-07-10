# AGENTS.md — Raspberry Dashboard

Dashboard per monitorare/gestire più Raspberry Pi (4 appartamenti) via VPN. Backend FastAPI + frontend React, orchestrati con Docker Compose.

## Architettura (il "big picture")
- **Config-driven**: la verità sui device sta in `config/devices.yaml` (gitignored; template in `devices.example.yaml`). All'avvio (`app/main.py` → `lifespan`) `device_service.sync_config_to_db` la sincronizza nelle tabelle `apartments`/`devices`, e `bootstrap_admin` crea l'utente admin da `.env`.
- **Flusso metriche**: `scheduler/scheduler.py` (APScheduler, ogni `METRICS_INTERVAL_SECONDS`) → `metrics_service.run_collection_cycle` → per device: check TCP reachability + latenza, poi `collect_metrics` esegue i comandi read-only via SSH e `metric_parsers.py` trasforma stdout grezzo in numeri → `alerts_service` valuta soglie e genera/risolve `Alert` + `Event`.
- **Layer backend** (`backend/app/`): `api/routes/` (thin: validazione HTTP) → `services/` (logica) → `models/` (ORM SQLAlchemy 2.0 `Mapped`/`mapped_column`) + `schemas/` (Pydantic v2). Mai mettere logica SSH/DB nelle route.
- **DB**: SQLAlchemy con `DATABASE_URL` (SQLite di default, Postgres senza modifiche al codice). No Alembic: `db/init_db.py` usa `create_all()` + `_ensure_column()` per micro-migrazioni additive.

## Modello di sicurezza (invariante centrale — non aggirarlo)
- **Nessun comando arbitrario**: ogni comando SSH deve esistere in `ssh/allowlist.py` (`READONLY_COMMANDS` / `PRIVILEGED_COMMANDS`). Gli argomenti dinamici usano placeholder `{service}`/`{subnet}` validati (`is_valid_service_name`, `is_valid_cidr`) — mai f-string di input utente.
- **SSH solo a chiave** (`ssh/client.py`, Paramiko): niente password; chiavi in `secrets/ssh/` (gitignored, montate read-only).
- **Router separati** (`api/router.py`): `read`/`monitoring`/`commands` sono protetti da `Depends(get_current_user)` (JWT Bearer); solo `health` e `auth` sono pubblici.
- **Endpoint di comando** (`api/routes/commands.py`): richiedono `confirm: true`, hanno `Depends(rate_limit)` per IP, e ogni tentativo passa da `command_service.run_command` che scrive in `command_audit_logs` (pending→success/error/denied). Azioni Mysterium backup/restore richiedono `current_user.is_admin`.

## Convenzioni specifiche del progetto
- **Lingua**: commenti, docstring, messaggi d'errore e stringhe UI sono in **italiano**. Mantieni questa convenzione.
- **Settings**: sempre `from app.core.config import get_settings` (cache `@lru_cache`), mai leggere `os.environ` direttamente.
- **Pydantic v2**: converti ORM→schema con `SchemaRead.model_validate(obj)` (vedi `read.py`).
- **Import lazy nelle route**: modelli/servizi pesanti importati dentro la funzione route (vedi `read.py::device_services`) per ridurre l'accoppiamento — segui lo stile esistente.
- **Frontend**: tutte le chiamate passano da `frontend/src/services/api.ts` (unico client axios). L'interceptor aggiunge `Bearer` da `localStorage` e su 401 emette `window.dispatchEvent('auth:logout')`. Non usare `fetch` diretto; aggiungi funzioni tipizzate qui e i tipi in `src/types/`.

## Workflow sviluppo
- **Locale (Windows, no Docker)**: `.\run-local.ps1` (crea venv, installa, avvia backend :8000 + frontend :5173; login dev `admin`/`admin`). Richiede **Python 3.12** (wheel pydantic-core). `-SkipInstall` per avvii rapidi.
- **Docker**: `docker compose up --build` (backend :8000, frontend :8080; il frontend parte solo quando il backend è `healthy`). Path interni (`/data`, `/config`, `/secrets`) sono impostati in `docker-compose.yml`, diversi da quelli locali.
- **Test backend**: `cd backend && pytest`. Focus dei test: parser metriche, soglie, allowlist/anti-injection, security (hash+JWT). Vedi `tests/test_allowlist.py` come esempio.
- **Build frontend**: `npm run dev` / `npm run build` (`tsc -b && vite build`).
- **Reset schema in sviluppo** dopo cambi ai modelli: `docker compose down -v` (elimina il volume `backend_data`) e riavvia.

## Aggiungere un nuovo comando remoto (pattern end-to-end)
1. Aggiungi la stringa in `ssh/allowlist.py` (`PRIVILEGED_COMMANDS`).
2. Esponi la route in `api/routes/commands.py` con `Depends(rate_limit)`, `_require_confirm`, e chiama `command_service.run_command(...)` (audit automatico).
3. Aggiungi lo schema in `schemas/command.py` se servono nuovi campi.
4. Aggiungi la funzione tipizzata in `frontend/src/services/api.ts` + UI con modale di conferma per azioni distruttive.
5. Documenta la riga sudoers NOPASSWD richiesta nel README.


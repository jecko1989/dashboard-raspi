# AGENTS.md — Raspberry Dashboard

Dashboard per monitorare e gestire piu Raspberry Pi (organizzati in "luoghi", es. 4 appartamenti) via VPN. Stack backend FastAPI + frontend React, orchestrati con Docker Compose.

## Architettura (big picture)
- **Config-driven**: la fonte dei device e in `config/devices.yaml` (gitignored, template in `devices.example.yaml`). Il loader YAML accetta ancora la chiave legacy `apartments` (migra automaticamente a `luoghi`).
- **Startup backend**: in `app/main.py`, lifespan esegue `init_db`, `sync_config_to_db` e `bootstrap_admin`, poi avvia lo scheduler.
- **Flusso metriche**: `scheduler/scheduler.py` (APScheduler, `max_instances=1`, `coalesce=True`) esegue `run_collection_cycle` ogni `METRICS_INTERVAL_SECONDS` (default 60); per ogni device fa check TCP reachability e latenza, poi raccolta metriche SSH read-only, parsing e valutazione alert/eventi.
- **Layer backend** (`backend/app/`): `api/routes/` per HTTP e validazione, `services/` per logica applicativa, `models/` SQLAlchemy 2.0, `schemas/` Pydantic v2.
- **Database**: SQLAlchemy con `DATABASE_URL` (SQLite default, compatibile Postgres). Inizializzazione schema con `create_all` e micro-migrazioni additive in `db/init_db.py` (senza Alembic).
- **Nginx proxy**: il frontend usa URL relativi (`/api`) e nginx fa da proxy verso il backend — lo stesso bundle funziona su qualsiasi indirizzo senza rebuild. Non esiste più `VITE_API_BASE_URL` (deprecata).

## Modello di sicurezza (invariante centrale)
- **Nessun comando arbitrario**: ogni comando remoto deve esistere in `ssh/allowlist.py`.
- **Eccezione controllata (shell web)**: la shell interattiva admin-only (`services/shell_service.py`, WebSocket in `api/routes/shell.py`) consente comandi liberi via SSH PTY. È l'unica eccezione all'invariante e va mantenuta blindata: solo admin, `SHELL_ENABLED` per disattivarla, rate limit per utente, limite sessioni, timeout sessione/inattività, audit in `command_audit_logs` (comando `shell`) ed `events`.
- **Placeholder dinamici**: ammessi solo dove previsto e validati in modo stretto (`is_valid_service_name` per `service`, `is_valid_cidr` per `subnet`, `is_valid_pwm_value` per valori PWM 0–255).
- **SSH solo a chiave**: niente password SSH. Le chiavi risiedono in `secrets/ssh` (gitignored, mount read-only in Docker).
- **Separazione endpoint**: `health` e `auth` pubblici; `read`, `monitoring`, `commands` e `ssh-keys` protetti da JWT (`get_current_user`). La shell WebSocket non usa l'header Bearer: il JWT arriva in query string (`token`) ed è validato in `shell_service.authenticate_token` (richiede admin).
- **Endpoint comandi**: richiedono `confirm=true`, applicano rate limit per IP e passano da `command_service.run_command` con audit in `command_audit_logs` (`pending`, `success`, `error`, `denied`).
- **Azioni sensibili**: backup/restore Mysterium, generazione chiavi SSH e shell web sono consentiti solo ad admin.
- **Cambio password**: `POST /auth/change-password` richiede verifica della vecchia password prima di aggiornare (bcrypt); disponibile a tutti gli utenti autenticati.

## Convenzioni del progetto
- **Lingua**: commenti, docstring, errori e stringhe UI in italiano.
- **Config**: usare sempre `get_settings` da `app.core.config`; evitare accesso diretto a `os.environ` nei moduli applicativi.
- **Route sottili**: logica SSH, DB e business nei services, non nelle route.
- **Pydantic v2**: conversione ORM verso schema con `model_validate`.
- **Import lazy nelle route**: usarli quando opportuno per ridurre accoppiamento e side effect.
- **Frontend API**: tutte le chiamate HTTP passano da `frontend/src/services/api.ts`.
- **Frontend auth**: interceptor aggiunge Bearer token da localStorage; su 401 emette evento `auth:logout`. Il ruolo admin è esposto da `AuthContext` come `isAdmin` (da `getMe()`), usato per mostrare le azioni riservate (es. shell web).
- **Frontend WebSocket**: la shell usa WebSocket nativo con token in query string; l'URL si costruisce con `frontend/src/services/shell.ts` (deriva `ws`/`wss` dall'host corrente della pagina, override con `VITE_API_WS_URL`).
- **No fetch diretto**: aggiungere funzioni tipizzate in `services/api.ts` e tipi in `src/types`.
- **URL relativi**: il frontend usa sempre `/api/...` senza prefisso di host; non usare `VITE_API_BASE_URL` (deprecata e rimossa). Usare `VITE_API_WS_URL` solo per override WebSocket.
- **Hooks**: logica di fetch/stato incapsulata in hook dedicati (`useDevices`, `useLuoghi`, `useScopedEvents`); evitare chiamate API dirette nei componenti.
- **Utils**: formattazione valori in `frontend/src/utils/format.ts`; non duplicare la logica nei componenti.

## Workflow sviluppo
- **Locale Windows (senza Docker)**: usare `run-local.ps1` (setup venv Python 3.12, install dipendenze, avvio backend e frontend). Supporta `-SkipInstall`.
- **Login sviluppo locale**: `admin / admin` (bootstrap dallo script locale).
- **Docker**: `docker compose up --build`. Backend su `:8000`, frontend su `:8080`, frontend avviato dopo health backend.
- **Path Docker vs locale**: in container usare `/data`, `/config`, `/secrets`; in locale usare path relativi progetto.
- **Test backend**: `cd backend && pytest`.
- **Build frontend**: `npm run dev` oppure `npm run build`.
- **Skill Copilot Agent** (`.github/skills/`): `aggiorna-documentazioni` — aggiorna CHANGELOG, ROADMAP, AGENTS.md e README prima di una PR; `crea-pr` — verifica branch, invoca aggiorna-documentazioni e apre la PR via `gh` CLI con titolo/descrizione generati dai commit.

## Frontend struttura
- **Pagine** (`src/pages/`): `Login`, `Overview`, `LuogoPage`, `DeviceDetailPage`, `AlertsPage`, `Settings`.
- **Hooks** (`src/hooks/`): `useDevices` (fetch e stato device), `useLuoghi` (fetch e stato luoghi), `useScopedEvents` (eventi filtrati per device/luogo).
- **Context** (`src/context/`): `AuthContext` — espone `user`, `isAdmin`, `login`, `logout`.
- **Services** (`src/services/`): `api.ts` (tutte le chiamate HTTP), `shell.ts` (costruzione URL WebSocket).
- **Types** (`src/types/index.ts`): tutti i tipi TypeScript dell'applicazione.
- **Utils** (`src/utils/format.ts`): funzioni di formattazione valori (CPU, RAM, temperatura, ecc.).
- **Componenti notevoli**: `ShellModal` (shell web admin), `ChangePasswordModal`, `DeviceCommands`, `DeviceSSHKey`, `EventsPanel`/`EventTimeline`, `LuogoFormModal`, `DeviceFormModal`/`DeviceCreateModal`.

## Variabili d'ambiente
Tutte lette da `app.core.config` (pydantic-settings). Fonte di verità: `backend/app/core/config.py`.

| Variabile | Default | Note |
|---|---|---|
| `DATABASE_URL` | `sqlite:////data/raspberry_dashboard.db` | Compatibile Postgres |
| `SSH_KEYS_DIR` | `/secrets/ssh` | Path chiavi SSH device |
| `DEVICES_CONFIG_PATH` | `/config/devices.yaml` | Source of truth device |
| `SSH_CONNECT_TIMEOUT` | `8.0` | Timeout TCP/SSH (sec) |
| `SSH_KNOWN_HOSTS_PATH` | `""` | Opzionale; se vuoto usa TOFU |
| `SSH_AUTO_ADD_HOST_KEYS` | `true` | TOFU — disabilitare in prod |
| `JWT_SECRET_KEY` | `CHANGE_ME` | ⚠️ Obbligatorio cambiare |
| `JWT_EXPIRE_MINUTES` | `60` | Durata token JWT |
| `ADMIN_USERNAME` | `admin` | Bootstrap account |
| `ADMIN_PASSWORD` | `CHANGE_ME` | ⚠️ Obbligatorio cambiare |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated |
| `METRICS_INTERVAL_SECONDS` | `60` | Intervallo scheduler |
| `COMMAND_RATE_LIMIT_PER_MINUTE` | `10` | Rate limit comandi per IP |
| `SHELL_ENABLED` | `true` | Disattivare per disabilitare shell web |
| `SHELL_SESSION_TIMEOUT_SECONDS` | `1800` | Durata max sessione shell |
| `SHELL_IDLE_TIMEOUT_SECONDS` | `300` | Timeout inattività shell |
| `SHELL_MAX_SESSIONS` | `3` | Sessioni concorrenti globali |
| `SHELL_RATE_LIMIT_PER_MINUTE` | `5` | Aperture shell per utente/min |

## Pattern: aggiungere un nuovo comando remoto
1. Definire il comando in `ssh/allowlist.py` dentro `PRIVILEGED_COMMANDS`.
2. Se ci sono argomenti dinamici, usare solo placeholder consentiti e validazione esplicita.
3. Esporre endpoint in `api/routes/commands.py` con conferma obbligatoria, rate limit e invocazione di `command_service.run_command` (o helper dedicato).
4. Aggiornare `schemas/command.py` se servono nuovi campi request/response.
5. Aggiungere funzione tipizzata in `frontend/src/services/api.ts`.
6. Collegare UI con conferma esplicita per azioni distruttive.
7. Documentare la riga sudoers NOPASSWD necessaria in README.

## Pattern: aggiungere endpoint operativo sensibile
1. Applicare autenticazione JWT e verifica ruolo admin se richiesto.
2. Validare input in schema Pydantic e in service.
3. Tracciare audit/eventi quando l'azione ha impatto operativo.
4. Mantenere nel README i dettagli di setup host richiesti (sudoers, permessi, ecc.).

## Note operative
- Lo scheduler e il monitoraggio sono attivi nel codice applicativo.
- Il servizio comandi gestisce lock per-device per evitare update apt concorrenti.
- Backup/restore Mysterium usa stream binario via SSH (`SSHClient.run_binary()`) e richiede privilegi admin.
- Generazione chiavi SSH device e centralizzata in endpoint dedicato (`ssh-key/generate`); se il mount è read-only Docker, la chiave privata viene restituita nella response anziché salvata su disco.
- Shell web: chiamate Paramiko bloccanti eseguite fuori dall'event loop (`asyncio.to_thread`/executor); dietro nginx serve l'upgrade WebSocket per `/api/ws/`. Variabili: `SHELL_ENABLED`, `SHELL_SESSION_TIMEOUT_SECONDS`, `SHELL_IDLE_TIMEOUT_SECONDS`, `SHELL_MAX_SESSIONS`, `SHELL_RATE_LIMIT_PER_MINUTE`.
- Config loader (`services/config_loader.py`): espande `${SSH_KEYS_DIR}` negli yaml, accetta "apartments" come alias legacy per "luoghi".
- DB migrazioni (`db/init_db.py`): additive, senza Alembic; include rename `apartments`→`luoghi` e colonna `apartment_id`→`luogo_id` (v0.6.0).
- Metriche: modello include `fan_rpm` e `fan_mode` (v0.7.0). Export CSV disponibile via `GET /devices/{id}/metrics/export.csv`.
- Cancellazione eventi: `POST /events/delete` (admin-only, con filtri device_id/luogo_id).

## Checklist rapida prima di merge
1. Route sottili e logica nei services.
2. Nessun comando SSH fuori allowlist.
3. Testi utente in italiano.
4. Tipi e client frontend aggiornati in modo tipizzato.
5. Test backend aggiunti/aggiornati per il nuovo comportamento.


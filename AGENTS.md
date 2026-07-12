# AGENTS.md — Raspberry Dashboard

Dashboard per monitorare e gestire piu Raspberry Pi (organizzati in "luoghi", es. 4 appartamenti) via VPN. Stack backend FastAPI + frontend React, orchestrati con Docker Compose.

## Architettura (big picture)
- **Config-driven**: la fonte dei device e in `config/devices.yaml` (gitignored, template in `devices.example.yaml`).
- **Startup backend**: in `app/main.py`, lifespan esegue `init_db`, `sync_config_to_db` e `bootstrap_admin`, poi avvia lo scheduler.
- **Flusso metriche**: `scheduler/scheduler.py` esegue `run_collection_cycle` a intervallo; per ogni device fa check TCP reachability e latenza, poi raccolta metriche SSH read-only, parsing e valutazione alert/eventi.
- **Layer backend** (`backend/app/`): `api/routes/` per HTTP e validazione, `services/` per logica applicativa, `models/` SQLAlchemy 2.0, `schemas/` Pydantic v2.
- **Database**: SQLAlchemy con `DATABASE_URL` (SQLite default, compatibile Postgres). Inizializzazione schema con `create_all` e micro-migrazioni additive in `db/init_db.py`.

## Modello di sicurezza (invariante centrale)
- **Nessun comando arbitrario**: ogni comando remoto deve esistere in `ssh/allowlist.py`.
- **Eccezione controllata (shell web)**: la shell interattiva admin-only (`services/shell_service.py`, WebSocket in `api/routes/shell.py`) consente comandi liberi via SSH PTY. È l'unica eccezione all'invariante e va mantenuta blindata: solo admin, `SHELL_ENABLED` per disattivarla, rate limit per utente, limite sessioni, timeout sessione/inattività, audit in `command_audit_logs` (comando `shell`) ed `events`.
- **Placeholder dinamici**: ammessi solo dove previsto e validati in modo stretto (`is_valid_service_name` per `service`, `is_valid_cidr` per `subnet`).
- **SSH solo a chiave**: niente password SSH. Le chiavi risiedono in `secrets/ssh` (gitignored, mount read-only in Docker).
- **Separazione endpoint**: `health` e `auth` pubblici; `read`, `monitoring`, `commands` e `ssh-keys` protetti da JWT (`get_current_user`). La shell WebSocket non usa l'header Bearer: il JWT arriva in query string (`token`) ed è validato in `shell_service.authenticate_token` (richiede admin).
- **Endpoint comandi**: richiedono `confirm=true`, applicano rate limit per IP e passano da `command_service.run_command` con audit in `command_audit_logs` (`pending`, `success`, `error`, `denied`).
- **Azioni sensibili**: backup/restore Mysterium, generazione chiavi SSH e shell web sono consentiti solo ad admin.

## Convenzioni del progetto
- **Lingua**: commenti, docstring, errori e stringhe UI in italiano.
- **Config**: usare sempre `get_settings` da `app.core.config`; evitare accesso diretto a `os.environ` nei moduli applicativi.
- **Route sottili**: logica SSH, DB e business nei services, non nelle route.
- **Pydantic v2**: conversione ORM verso schema con `model_validate`.
- **Import lazy nelle route**: usarli quando opportuno per ridurre accoppiamento e side effect.
- **Frontend API**: tutte le chiamate HTTP passano da `frontend/src/services/api.ts`.
- **Frontend auth**: interceptor aggiunge Bearer token da localStorage; su 401 emette evento `auth:logout`. Il ruolo admin è esposto da `AuthContext` come `isAdmin` (da `getMe()`), usato per mostrare le azioni riservate (es. shell web).
- **Frontend WebSocket**: la shell usa WebSocket nativo con token in query string; l'URL si costruisce con `frontend/src/services/shell.ts` (deriva `ws`/`wss` da `VITE_API_BASE_URL`, override con `VITE_API_WS_URL`).
- **No fetch diretto**: aggiungere funzioni tipizzate in `services/api.ts` e tipi in `src/types`.

## Workflow sviluppo
- **Locale Windows (senza Docker)**: usare `run-local.ps1` (setup venv Python 3.12, install dipendenze, avvio backend e frontend). Supporta `-SkipInstall`.
- **Login sviluppo locale**: `admin / admin` (bootstrap dallo script locale).
- **Docker**: `docker compose up --build`. Backend su `:8000`, frontend su `:8080`, frontend avviato dopo health backend.
- **Path Docker vs locale**: in container usare `/data`, `/config`, `/secrets`; in locale usare path relativi progetto.
- **Test backend**: `cd backend && pytest`.
- **Build frontend**: `npm run dev` oppure `npm run build`.

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
- Backup/restore Mysterium usa stream binario via SSH e richiede privilegi admin.
- Generazione chiavi SSH device e centralizzata in endpoint dedicato (`ssh-key/generate`).
- Shell web: chiamate Paramiko bloccanti eseguite fuori dall'event loop (`asyncio.to_thread`/executor); dietro nginx serve l'upgrade WebSocket per `/api/ws/`. Variabili: `SHELL_ENABLED`, `SHELL_SESSION_TIMEOUT_SECONDS`, `SHELL_IDLE_TIMEOUT_SECONDS`, `SHELL_MAX_SESSIONS`, `SHELL_RATE_LIMIT_PER_MINUTE`.

## Checklist rapida prima di merge
1. Route sottili e logica nei services.
2. Nessun comando SSH fuori allowlist.
3. Testi utente in italiano.
4. Tipi e client frontend aggiornati in modo tipizzato.
5. Test backend aggiunti/aggiornati per il nuovo comportamento.


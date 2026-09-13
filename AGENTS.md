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

Convenzioni specifiche di backend/frontend sono in `backend/CLAUDE.md` e `frontend/CLAUDE.md` (si caricano solo quando si lavora in quelle directory).

## Workflow sviluppo
- **Locale Windows (senza Docker)**: usare `run-local.ps1` (setup venv Python 3.12, install dipendenze, avvio backend e frontend). Supporta `-SkipInstall`.
- **Login sviluppo locale**: `admin / admin` (bootstrap dallo script locale).
- **Docker**: `docker compose up --build`. Backend su `:8000`, frontend su `:8080`, frontend avviato dopo health backend.
- **Path Docker vs locale**: in container usare `/data`, `/config`, `/secrets`; in locale usare path relativi progetto.
- **Test backend**: `cd backend && pytest`.
- **Build frontend**: `npm run dev` oppure `npm run build`.
- **Skill Copilot Agent** (`.github/skills/`): `aggiorna-documentazioni` — aggiorna CHANGELOG, ROADMAP, AGENTS.md e README prima di una PR; `crea-pr` — verifica branch, invoca aggiorna-documentazioni e apre la PR via `gh` CLI con titolo/descrizione generati dai commit.
- **Skill Claude Code** (`.claude/skills/`): stesse due skill (`aggiorna-documentazioni`, `crea-pr`), convertite per essere invocate come slash command o auto-invocate da Claude Code in questo repo. Versioni generiche equivalenti (senza assunzioni specifiche su questo repo) vivono in `~/.claude/skills/` e si applicano a qualsiasi progetto.
- **Deploy manuale** (`scripts/deploy.sh --mode docker|native`): ogni chiamata SSH/SCP/rsync è limitata da timeout differenziati (`REMOTE_PROBE_TIMEOUT`, `REMOTE_CMD_TIMEOUT`, `REMOTE_TRANSFER_TIMEOUT`, `REMOTE_BUILD_TIMEOUT`, `LOCAL_CMD_TIMEOUT`) e da retry automatico sui soli fallimenti di trasporto (`SSH_RETRY_COUNT`/`SSH_RETRY_DELAY`, exit 255/124) — dettagli in `deploy/deploy.env.example` e `docs/DEPLOYMENT.md`.
- **Deploy da GitHub Actions** (`.github/workflows/deploy.yml`): stesso `deploy.sh`, eseguito da un runner Linux che si unisce alla tailnet privata via `tailscale/github-action` (OAuth client con scope `Devices: Core Write` + `Keys: Auth Keys Write`, tag `tag:ci-deploy` ristretto via ACL alla sola porta 22 del Pi). Trigger solo `workflow_dispatch` (mai `push`/`pull_request`: il repo è pubblico), con `dry_run` di default. Setup completo in `docs/DEPLOYMENT.md` §16.

## Variabili d'ambiente
Vedi `backend/app/core/config.py` per l'elenco completo delle variabili d'ambiente, i default e le note (file autodocumentato con commenti inline).

## Pattern: aggiungere un comando remoto o un endpoint sensibile
Vedi la skill `.claude/skills/aggiungere-comando-o-endpoint/SKILL.md` per la checklist passo-passo.

## Note operative
- Lo scheduler e il monitoraggio sono attivi nel codice applicativo.
- Il servizio comandi gestisce lock per-device per evitare update apt concorrenti.
- Backup/restore Mysterium usa stream binario via SSH (`SSHClient.run_binary()`) e richiede privilegi admin.
- Nodo Mysterium: puo' essere nativo (systemd, servizio `mysterium-node`) o containerizzato (Docker, container `myst`) a seconda del device — flag `DeviceConfig.myst_docker` in `devices.yaml` (default `false` = nativo). `command_service._resolve_myst_command_key` sceglie a runtime la variante corretta di `myst_start`/`myst_stop`/`myst_restart` (allowlist con chiavi `_native`/`_docker` separate); i chiamanti usano sempre le chiavi generiche. Backup/restore restano identici nei due casi (stessa data-dir `/var/lib/mysterium-node`, bind-mount se Docker). La modalita' Docker isola le interfacce dinamiche `myst#` nel network namespace del container, evitando rebind spuri di `tailscaled` sull'host.
- Il flag `myst_docker` (e il range porte UDP) e' impostabile da UI: checkbox in `DeviceCreateModal`/`DeviceFormModal`, persistito da `device_service.create_device`/`update_device` (validato con `allowlist.is_valid_port`, default 10000-60000 se non specificato). Il modale di modifica precompila lo stato corrente leggendo `GET /devices/{id}/myst/info`.
- Aggiornamento nodo myst containerizzato: `POST /devices/{id}/myst/update` (admin-only) orchestrato in `myst_service.update_docker_node` — pull immagine, `docker rm -f myst`, ricrea il container con `{udp_start}`/`{udp_end}` presi da `DeviceConfig.myst_docker_udp_start`/`myst_docker_udp_end` (validati con `is_valid_port`, devono corrispondere al port-forward configurato sul router). `GET /devices/{id}/myst/info` espone `docker: bool` al frontend per mostrare/nascondere il pulsante "Aggiorna nodo" (visibile solo sui device Docker).
- Generazione chiavi SSH device e centralizzata in endpoint dedicato (`ssh-key/generate`); se il mount è read-only Docker, la chiave privata viene restituita nella response anziché salvata su disco.
- Shell web: chiamate Paramiko bloccanti eseguite fuori dall'event loop (`asyncio.to_thread`/executor); dietro nginx serve l'upgrade WebSocket per `/api/ws/`. Variabili: `SHELL_ENABLED`, `SHELL_SESSION_TIMEOUT_SECONDS`, `SHELL_IDLE_TIMEOUT_SECONDS`, `SHELL_MAX_SESSIONS`, `SHELL_RATE_LIMIT_PER_MINUTE`.
- Config loader (`services/config_loader.py`): espande `${SSH_KEYS_DIR}` negli yaml, accetta "apartments" come alias legacy per "luoghi".
- DB migrazioni (`db/init_db.py`): additive, senza Alembic; include rename `apartments`→`luoghi` e colonna `apartment_id`→`luogo_id` (v0.6.0).
- Metriche: modello include `fan_rpm` e `fan_mode` (v0.7.0). Export CSV disponibile via `GET /devices/{id}/metrics/export.csv`.
- "Ultima volta online" (v0.8.0): quando un device e' offline, il frontend (`DeviceCard`, `DeviceDetails`) mostra `formatDateTime(device.last_metric_at)` al posto dell'uptime — riusa il campo `last_metric_at` gia' presente su `Device` (aggiornato solo dopo una raccolta metriche riuscita, quindi solo mentre il device e' online), senza bisogno di una colonna dedicata.
- Controllo ventola (`deploy/scripts/dashboard-fan-control.sh`): rileva a runtime l'interfaccia PWM disponibile sul device invece di assumerne una fissa. Preferisce hwmon (`/sys/class/hwmon/hwmon*/pwm*_enable`) se presente — caso Raspberry Pi 5 (fan nativa) o Pi4 con Raspberry Pi OS e `dtoverlay=pwm-fan` — dove supporta sia modalita' automatica (`pwm`, termostatata dal kernel) sia fissa. Se hwmon manca, fa fallback su `/sys/class/pwm/pwmchip0` (caso Pi4 con Ubuntu, il cui pacchetto `linux-firmware-raspi` non include l'overlay `pwm-fan` ma solo l'overlay generico `pwm.dtbo`, da abilitare con `dtoverlay=pwm` in `config.txt`): qui e' supportata solo la modalita' fissa (duty-cycle su periodo fisso 40000ns/25kHz), la modalita' automatica risponde con errore esplicito invece di un comportamento silenzioso, perche' manca il binding kernel verso la thermal zone.
- Selezione canale ventola su device multi-fan (desktop con piu' header, es. Super I/O nct6775/nct679x): sia lo script di controllo sia i comandi read-only `fan_rpm`/`fan_mode` (`ssh/allowlist.py`) preferiscono a runtime il canale hwmon con una ventola realmente collegata (RPM > 0 misurato ora) invece del primo trovato, cosi' i due valori restano coerenti tra loro. Se l'auto-detect sceglie il canale sbagliato (es. sensore GPU o header vuoto con RPM momentaneamente >0), si puo' forzare esplicitamente in `/etc/default/dashboard-fan-control` sul device con `PWM_CHIP_NAME`/`PWM_CHANNEL_INDEX` (nome hwmon e indice N di `pwmN_enable`/`fanN_input`, non l'indice `hwmonN` che non e' stabile tra un boot e l'altro) e opzionalmente `PWM_TEMP_SEL` (sonda per la modalita' automatica) — dettagli e caveat sulla modalita' "Auto" dei chip Super I/O in `docs/DEPLOYMENT.md`. Il nome chip va verificato con `cat /sys/class/hwmon/hwmon*/name` sul device reale: puo' differire da un modello simile (es. `nct6792` vs `nct6797`).
- Cancellazione eventi: `POST /events/delete` (admin-only, con filtri device_id/luogo_id).
- Aggiornamento pacchetti (`update_upgrade`): usa `DEBIAN_FRONTEND=noninteractive` per evitare che domande debconf (es. `console-setup`/`keyboard-configuration` durante la configurazione di pacchetti in fase di aggiornamento) blocchino indefinitamente il processo su una sessione SSH non interattiva (il processo puo' restare orfano e tenere il lock dpkg se la sessione si chiude prima). Richiede sui device la regola sudoers dedicata `Defaults!DASHBOARD_APT_UPGRADE env_keep += "DEBIAN_FRONTEND"` (scoped al solo comando, non un `env_keep` globale) — vedi README.md "Configurazione sudoers richiesta sui Raspberry".

## Checklist rapida prima di merge
1. Route sottili e logica nei services.
2. Nessun comando SSH fuori allowlist.
3. Testi utente in italiano.
4. Tipi e client frontend aggiornati in modo tipizzato.
5. Test backend aggiunti/aggiornati per il nuovo comportamento.


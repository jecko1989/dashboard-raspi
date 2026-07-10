# dashboard-raspi

Personal dashboard to monitor and manage multiple Raspberry Pi devices over a Tailscale network (FastAPI + React)

> **Stato del progetto: Fase 5 — Rifinitura finale.**
> Progetto completo: **autenticazione** (login locale username/password, password
> hashata bcrypt, JWT), endpoint protetti, **esportazione CSV** delle metriche,
> rifiniture UI (dark mode, badge VPN/latenza, timeline attività), **healthcheck**
> Docker e test minimi. Avviabile con `docker compose up --build` o in locale.

---

## Stack

| Livello   | Tecnologia |
|-----------|-----------|
| Backend   | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, APScheduler, Paramiko |
| Frontend  | React 18, TypeScript, Vite, Tailwind CSS, React Router, Recharts |
| Database  | SQLite (migrabile a PostgreSQL cambiando solo `DATABASE_URL`) |
| Deploy    | Docker Compose (backend + frontend) |

---

## Struttura del progetto

```
dashboard-raspi/
  backend/
    app/
      main.py            # entry point FastAPI
      api/               # router: read-only, commands, auth, health
      core/              # config, logging, security
      db/                # engine, sessione, init schema
      models/            # modelli ORM (users, devices, metrics, ...)
      schemas/           # modelli Pydantic
      services/          # config loader, device service, metrics (stub)
      ssh/               # client SSH (stub) + allowlist comandi
      scheduler/         # scheduler raccolta metriche (stub)
    tests/               # test minimi
    requirements.txt
    Dockerfile
  frontend/
    src/
      components/        # Layout, Sidebar, DeviceCard, MetricCard, ...
      pages/             # Overview, ApartmentPage, DeviceDetailPage, ...
      services/          # client API
      hooks/             # useDevices, useApartments
      types/             # tipi condivisi
      App.tsx / main.tsx
    package.json
    Dockerfile
  config/
    devices.example.yaml # template versionato (copia in devices.yaml)
    devices.yaml         # appartamenti e device reali (IGNORATO da git)
  secrets/ssh/           # chiavi SSH private (mai committare)
  docker-compose.yml
  .env.example
  README.md
```

---

## Inizializzare il repository Git (push su GitHub)

Il progetto include un `.gitignore` che **esclude automaticamente** i file
sensibili e locali. Prima del primo push assicurati che **nulla di segreto** sia
tracciato.

### File esclusi (NON finiscono su GitHub)

| File / cartella | Motivo |
|---|---|
| `.env`, `*.env` | segreti: `JWT_SECRET_KEY`, `ADMIN_PASSWORD`, ecc. |
| `secrets/ssh/id_*`, `*.key`, `*.pem` | chiavi SSH private dei Raspberry |
| `config/ovpn-profiles/`, `*.ovpn` | profili OpenVPN con chiavi/certificati |
| `config/devices.yaml` | IP/hostname reali (usa `devices.example.yaml`) |
| `*.db`, `*.sqlite*`, `data/` | database con utenti e audit |
| `.venv/`, `__pycache__/`, `node_modules/`, `dist/` | ambienti e build locali |

### File versionati (template, da tenere nel repo)
`.env.example`, `config/devices.example.yaml`, `secrets/ssh/README.md`.

### Passi

```powershell
# 1. inizializza il repo
git init
git add -A

# 2. VERIFICA di sicurezza: questo comando deve mostrare SOLO
#    .env.example, config/devices.example.yaml e secrets/ssh/README.md
git ls-files | Select-String 'env|ovpn|\.key|id_|\.db|secrets/|devices\.yaml'

# 3. se la verifica è pulita, crea il primo commit
git commit -m "Initial commit"

# 4. collega il repository GitHub (creato come PRIVATO) e pusha
git branch -M main
git remote add origin https://github.com/<tuo-utente>/<tuo-repo>.git
git push -u origin main
```

> ⚠️ Se al punto 2 compare una chiave, un `.env` reale, un `.ovpn` o
> `config/devices.yaml`, **fermati**: rimuovilo dallo stage con
> `git rm --cached <file>` prima di committare.
>
> Consiglio: crea il repository GitHub come **privato**, vista la natura
> personale della configurazione.

---

## File `.env` (posizione e valori da cambiare)

Il file `.env` contiene i **segreti** ed è **escluso da git** (`.gitignore`): non è
presente nel repo, va **creato dal template** `.env.example`.

| Modalità | Posizione del file | Come crearlo |
|---|---|---|
| **Docker** | root del progetto (`dashboard-raspi/.env`) — letto da `docker-compose.yml` (`env_file`) | `copy .env.example .env` |
| **Locale (no Docker)** | `backend/.env` — letto automaticamente da uvicorn all'avvio | `copy .env.example backend\.env` |

Per l'esecuzione **locale** usa i **percorsi locali** (non `/data`, `/config`,
`/secrets`, che sono i path *dentro* il container):

```dotenv
DATABASE_URL="sqlite:///./raspberry_dashboard.db"
DEVICES_CONFIG_PATH="..\config\devices.yaml"
SSH_KEYS_DIR="..\secrets\ssh"
CORS_ORIGINS="http://localhost:5173"
```

### ⚠️ Valori da cambiare subito (prima del primo avvio)

1. **`JWT_SECRET_KEY`** — genera un secret casuale robusto:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
2. **`ADMIN_PASSWORD`** — imposta una password admin robusta. L'utente admin viene
   creato **una sola volta** al primo avvio da `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
3. (**solo Docker**) **`VITE_API_BASE_URL`** se il backend non è su `localhost:8000`.

---

## Avvio rapido (con Docker)

### 1. Prerequisiti
- Docker + Docker Compose

### 2. Configura le variabili d'ambiente
```bash
cp .env.example .env
```
Modifica `.env` almeno per:
- `JWT_SECRET_KEY` (genera un valore casuale robusto);
- `ADMIN_PASSWORD`;
- eventualmente `VITE_API_BASE_URL` se il backend non è su `localhost:8000`.

### 3. Prepara la cartella chiavi SSH
La cartella `secrets/ssh/` esiste già con un README. In Fase 1 non è necessario
inserire chiavi reali (SSH è ancora skeleton), ma la struttura è pronta.

### 4. Personalizza `config/devices.yaml`
Il file `config/devices.yaml` è **ignorato da git** (contiene IP/hostname reali):
crealo dal template versionato e poi modificalo.

```bash
cp config/devices.example.yaml config/devices.yaml     # Linux/macOS
copy config\devices.example.yaml config\devices.yaml   # Windows
```

Cerca i marcatori **`# MODIFICA QUI`** e imposta:
- `ip_vpn` — IP VPN reale di ogni Raspberry;
- `hostname` — hostname reale;
- `ssh.username`, `ssh.port`, `ssh.key_path`;
- `services` — servizi systemd da monitorare per quel device.

### 5. Avvia
```bash
docker compose up --build
```

- Backend: <http://localhost:8000> — docs interattive su `/docs`, health su `/api/health`
- Frontend: <http://localhost:8080>

---

## Esecuzione in locale (senza Docker)

Usa questa modalità se su una macchina **Docker non è disponibile** (es. policy
aziendali). Backend e frontend girano direttamente sull'host in due processi
separati.

### Prerequisiti
- **Python 3.12** — obbligatorio. Alcune dipendenze (es. `pydantic-core`) non hanno
  ancora wheel precompilate per Python 3.13/3.14 e su Windows richiederebbero il
  compilatore Rust + Visual C++ Build Tools. Con Python 3.12 l'installazione è
  immediata.
  Verifica: `py -3.12 --version` (Windows) oppure `python3.12 --version`.
- **Node.js 20 LTS** + npm. Verifica: `node --version`.
- (Per metriche reali) VPN OpenVPN attiva + chiavi SSH in `secrets/ssh/`.

### 1. Configurazione
Dalla cartella `dashboard-raspi/`:
```powershell
copy .env.example .env
copy config\devices.example.yaml config\devices.yaml
```
Personalizza `config/devices.yaml` (marcatori `# MODIFICA QUI`).

### Avvio rapido con script

È disponibile uno script che fa tutto (venv, dipendenze, avvio) e apre due
finestre PowerShell, una per il backend e una per il frontend:

```powershell
.\run-local.ps1                 # prima esecuzione: crea venv, installa, avvia
.\run-local.ps1 -SkipInstall    # avvii successivi: più veloce, salta le install
.\run-local.ps1 -BackendPort 8001 -FrontendPort 5174
```

Se **Python 3.12 non è installato**, lo script si ferma con un messaggio che elenca
le versioni presenti e come procedere. Puoi installarlo automaticamente (via winget):
```powershell
.\run-local.ps1 -InstallPython
```
oppure manualmente: `winget install -e --id Python.Python.3.12` o dal
[sito ufficiale](https://www.python.org/downloads/release/python-3120/).

Se PowerShell blocca l'esecuzione degli script, abilitala per l'utente corrente:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

In alternativa allo script, puoi avviare i due processi manualmente come descritto
di seguito.

### 2. Backend (terminale 1)

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Variabili d'ambiente con PERCORSI LOCALI (non quelli del container).
# In locale il DB e i path config/chiavi non sono /data, /config, /secrets.
$env:DATABASE_URL        = "sqlite:///./raspberry_dashboard.db"
$env:DEVICES_CONFIG_PATH = "..\config\devices.yaml"
$env:SSH_KEYS_DIR        = "..\secrets\ssh"
$env:CORS_ORIGINS        = "http://localhost:5173"
$env:JWT_SECRET_KEY      = "un_valore_casuale_qualsiasi_per_sviluppo"

uvicorn app.main:app --reload --port 8000
```

Backend su <http://localhost:8000> (docs su `/docs`). Il file SQLite viene creato
in `backend/raspberry_dashboard.db`.

> Le variabili `$env:` valgono solo per la sessione PowerShell corrente. Per non
> reimpostarle ogni volta puoi creare un file **`backend/.env`** con le stesse
> chiavi (senza `$env:`), che viene letto automaticamente all'avvio.

### 3. Frontend (terminale 2)

```powershell
cd frontend
npm install
npm run dev
```

Frontend su <http://localhost:5173>. Di default chiama il backend su
`http://localhost:8000`; per cambiarlo imposta `VITE_API_BASE_URL` prima di
`npm run dev` (es. `$env:VITE_API_BASE_URL = "http://localhost:8000"`).

### Note
- Senza VPN attiva i device risulteranno **offline** (il check TCP fallisce): è
  normale, l'app funziona comunque.
- **Login in locale** (via `run-local.ps1`): utente `admin`, password `admin`
  (impostati dallo script per lo sviluppo). Con Docker si usano invece
  `ADMIN_USERNAME` / `ADMIN_PASSWORD` dal file `.env`.
- Per fermare: `Ctrl+C` in ciascun terminale. Per uscire dal venv: `deactivate`.

---

## Cosa funziona in Fase 2 (MVP monitoraggio)

- ✅ `GET /api/health` → `{"status": "ok"}`
- ✅ Appartamenti e device caricati da `config/devices.yaml` e sincronizzati nel DB
- ✅ `GET /api/apartments`, `GET /api/devices`, `GET /api/devices/{id}`
- ✅ **Stato online/offline reale** via check TCP sulla porta SSH, con **latenza** (ms)
- ✅ Logica *offline dopo N fallimenti consecutivi* (soglia in `devices.yaml`)
- ✅ **Raccolta metriche base via SSH**: CPU, RAM, disco, temperatura, uptime,
  load average, versione OS, kernel
- ✅ `GET /api/devices/{id}/metrics/latest` e `.../metrics/history`
- ✅ Registrazione **eventi** sul cambio di stato → `GET /api/events`
- ✅ **Scheduler** che esegue il ciclo di monitoraggio ogni `METRICS_INTERVAL_SECONDS`
- ✅ Refresh manuale: `POST /api/monitoring/refresh`, `POST /api/devices/{id}/check`
- ✅ Frontend: overview con "Aggiorna tutto", dettaglio device con metriche reali,
  latenza, comando SSH da copiare, dark mode

## Cosa aggiunge la Fase 3 (metriche avanzate, storico, alert)

- ✅ **Storico metriche** persistito e **grafici** (CPU, RAM, disco, temperatura)
  nella pagina di dettaglio device (Recharts)
- ✅ **Alert configurabili** generati automaticamente dal ciclo di monitoraggio:
  - `offline` (device non raggiungibile), `temperature`, `disk`, `ram`, `cpu`,
    `reboot` (rilevato da calo dell'uptime)
  - gli alert si **risolvono da soli** quando la condizione rientra
- ✅ **Soglie configurabili** in `config/devices.yaml` (globali + override per device)
- ✅ **Pagina Alert** e **timeline eventi** nel frontend
- ✅ **Silenziamento alert per device** (mute/unmute): `POST /api/devices/{id}/alerts/mute`
  e `.../unmute`
- ✅ `GET /api/alerts` (filtro `active_only`), `GET /api/settings/thresholds`
- ✅ **Pagina Impostazioni** che mostra le soglie correnti
- ⏳ Stato servizi systemd → Fase 4
- ⏳ Comandi remoti (reboot/shutdown/update/restart) → Fase 4

### Soglie alert (configurabili)

Nella sezione `thresholds` di `config/devices.yaml`:

| Soglia | Default | Alert generato |
|--------|---------|----------------|
| `temperature_celsius` | 70 | temperatura CPU troppo alta |
| `disk_percent` | 85 | disco quasi pieno |
| `ram_percent` | 85 | RAM elevata |
| `cpu_percent` | 90 | CPU elevata |
| `offline_after_failures` | 3 | device offline dopo N check falliti |

È possibile sovrascriverle per singolo device aggiungendo una sezione
`thresholds:` sotto il device (vedi esempio commentato in `devices.yaml`).

## Cosa aggiunge la Fase 4 (comandi remoti sicuri)

- ✅ **Comandi remoti** eseguiti via SSH, tutti passanti dall'**allowlist**:
  - `POST /api/devices/{id}/commands/reboot`
  - `POST /api/devices/{id}/commands/shutdown`
  - `POST /api/devices/{id}/commands/update` (con `dry_run: true` per simulare)
  - `POST /api/devices/{id}/services/{name}/restart`
- ✅ **Stato servizi** e **log** (read-only via SSH):
  - `GET /api/devices/{id}/services`
  - `GET /api/devices/{id}/services/{name}/logs`
- ✅ **Conferma obbligatoria**: gli endpoint richiedono `confirm: true`; il frontend
  mostra una **modale di conferma** per le azioni distruttive.
- ✅ **Rate limiting** per client IP sugli endpoint di comando
  (`COMMAND_RATE_LIMIT_PER_MINUTE`, default 10/min → HTTP 429 se superato).
- ✅ **Audit log** completo di ogni comando (pending → success/error/denied):
  `GET /api/audit`.
- ✅ **Separazione netta**: gli endpoint di comando sono nel router `commands`,
  distinti dai read-only.
- ✅ Frontend: pannello comandi nel dettaglio device, tabella servizi con restart e
  visualizzazione log, banner con l'esito del comando.
- ⏳ Autenticazione → endpoint placeholder (Fase 5).

### ⚠️ Configurazione sudoers richiesta sui Raspberry

I comandi privilegiati assumono una configurazione **sudo NOPASSWD ristretta**.
Senza di essa, reboot/shutdown/update/restart falliranno (l'esito verrà comunque
registrato in audit come `error`). **Non** si usano mai password sudo interattive.

Crea `/etc/sudoers.d/dashboard-raspi` sul Raspberry (con
`sudo visudo -f /etc/sudoers.d/dashboard-raspi`), sostituendo `pi` con l'utente
SSH e limitando i servizi a quelli che intendi gestire:

```sudoers
# --- Alimentazione (Riavvia / Spegni) ---
pi ALL=(root) NOPASSWD: /sbin/reboot
pi ALL=(root) NOPASSWD: /sbin/shutdown -h now

# --- Aggiornamenti di sistema (Aggiorna pacchetti) ---
pi ALL=(root) NOPASSWD: /usr/bin/apt-get update
pi ALL=(root) NOPASSWD: /usr/bin/apt-get -y upgrade
pi ALL=(root) NOPASSWD: /usr/bin/apt-get -s upgrade

# --- Restart servizi: SOLO quelli che vuoi gestire (esempi) ---
pi ALL=(root) NOPASSWD: /bin/systemctl restart ssh
pi ALL=(root) NOPASSWD: /bin/systemctl restart cron

# --- Tailscale (Exit node / Subnet routes) ---
pi ALL=(root) NOPASSWD: /usr/bin/tailscale set *

# --- Nodo Mysterium (Avvia / Ferma / Restart myst) ---
pi ALL=(root) NOPASSWD: /bin/systemctl start mysterium-node
pi ALL=(root) NOPASSWD: /bin/systemctl stop mysterium-node
pi ALL=(root) NOPASSWD: /bin/systemctl restart mysterium-node

# --- Backup/restore del nodo Mysterium (data-dir /var/lib/mysterium-node) ---
pi ALL=(root) NOPASSWD: /usr/bin/tar -czf - -C /var/lib/mysterium-node .
pi ALL=(root) NOPASSWD: /usr/bin/tar -xzf - -C /var/lib/mysterium-node
pi ALL=(root) NOPASSWD: /usr/bin/chown -R mysterium-node /var/lib/mysterium-node
```

`systemctl is-active` e `journalctl` (status/log) **non** richiedono sudo.
Valida sempre con `sudo visudo -c` e mantieni l'allowlist il più restrittiva
possibile. I percorsi assoluti (`/sbin/reboot`, `/bin/systemctl`, ecc.) devono
combaciare **alla lettera** con quelli in `backend/app/ssh/allowlist.py`: `sudo`
confronta la stringa esatta del comando. Su Ubuntu recente `/bin`/`/sbin` sono
symlink verso `/usr/bin`/`/usr/sbin`, quindi il binario esiste da entrambi i path,
ma se usi `/usr/bin/systemctl` mentre la dashboard invia `/bin/systemctl` la regola
**non combacia** e sudo chiede la password. Verifica il risultato con `sudo -n -l`.

## Cosa aggiunge la Fase 5 (rifinitura finale)

- ✅ **Autenticazione**: login locale username/password, password **hashata bcrypt**,
  **JWT** Bearer. Tutti gli endpoint (tranne `/api/health` e `/api/auth/login`) sono
  **protetti**.
  - `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
  - rate limiting anti brute-force sul login
  - l'utente che esegue un comando viene registrato in audit (`requested_by`)
- ✅ **Utente admin** creato automaticamente all'avvio da `ADMIN_USERNAME` /
  `ADMIN_PASSWORD` (`.env`).
- ✅ **Esportazione CSV** delle metriche: `GET /api/devices/{id}/metrics/export.csv`
  e pulsante "Esporta CSV" nel dettaglio device.
- ✅ Rifiniture UI: login page, logout e username nell'header, **badge VPN /
  latenza** sulle card, **timeline attività** nella overview, dark mode.
- ✅ **Healthcheck** Docker sul backend; il frontend parte solo quando il backend è
  `healthy`.
- ✅ Test minimi: parser metriche, soglie, allowlist/anti-injection, sicurezza
  (hash + JWT).

### 🔐 Primo accesso

Le credenziali iniziali vengono dal file `.env`:

```dotenv
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="CHANGE_ME_strong_password"
```

Imposta una password robusta **prima** del primo avvio (l'utente viene creato una
sola volta). Genera anche un `JWT_SECRET_KEY` casuale:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Come ottenere metriche reali

1. Inserisci le chiavi SSH private in `secrets/ssh/` (vedi
   [secrets/ssh/README.md](secrets/ssh/README.md)) e imposta i permessi a `600`.
2. In `config/devices.yaml` configura per ogni device `ip_vpn`, `ssh.username`,
   `ssh.port` e `ssh.key_path`.
3. Assicurati di essere connesso alla **VPN OpenVPN** così che gli IP `10.8.0.x`
   siano raggiungibili dal container backend.
4. Avvia lo stack e premi **"Verifica ora"** su un device, oppure attendi il ciclo
   automatico dello scheduler.

> **Nota host key SSH**: alla prima connessione le host key vengono aggiunte al volo
> (TOFU) perché `SSH_AUTO_ADD_HOST_KEYS=true`. Per un comportamento più rigido,
> imposta `SSH_KNOWN_HOSTS_PATH` a un file `known_hosts` verificato e/o
> `SSH_AUTO_ADD_HOST_KEYS=false`.

---

## Shell web interattiva (solo admin)

Dal dettaglio device, un utente **admin** può aprire una **shell interattiva** sul
Raspberry direttamente dal browser (terminale xterm.js collegato via **WebSocket**
a una sessione **SSH con PTY**). Il pulsante **"Apri shell"** compare solo agli
admin.

- **Endpoint**: `WS /api/ws/devices/{id}/shell?token=<JWT>&cols=<n>&rows=<n>`
- **Autenticazione**: i WebSocket browser non inviano l'header `Authorization`,
  quindi il **JWT** viene passato in **query string** (`token`) e validato lato
  server; l'accesso è consentito **solo agli utenti con `is_admin`**.
- **Protocollo**: il client invia messaggi JSON `{"type":"input","data":"…"}` e
  `{"type":"resize","cols":n,"rows":n}`; il server invia l'output del terminale come
  frame binari.

### ⚠️ Nota di sicurezza (eccezione all'allowlist)

La shell web è l'**unica** funzione che consente **comandi arbitrari** sul device:
è quindi un'eccezione controllata all'invariante "nessun comando arbitrario". È
mitigata da più livelli:

- riservata agli **admin** (verifica JWT lato WebSocket);
- **disattivabile globalmente** con `SHELL_ENABLED=false`;
- **rate limit** per utente e **numero massimo di sessioni** concorrenti;
- **timeout** di sessione e di **inattività** con chiusura automatica;
- ogni **apertura/chiusura** è tracciata in `command_audit_logs` (comando `shell`)
  e nella timeline `events`.

I comandi digitati girano con i **privilegi dell'utente SSH** del device: **non**
richiede regole sudoers aggiuntive. Per limitarne la portata, usa un utente SSH
con shell ristretta o permessi minimi. Consigliato tenere `SHELL_ENABLED=false`
quando la funzione non serve.

### Variabili d'ambiente

| Variabile | Default | Descrizione |
|---|---|---|
| `SHELL_ENABLED` | `true` | Abilita/disabilita globalmente la shell web |
| `SHELL_SESSION_TIMEOUT_SECONDS` | `1800` | Durata massima di una sessione, poi viene chiusa |
| `SHELL_IDLE_TIMEOUT_SECONDS` | `300` | Chiusura automatica dopo inattività (nessun I/O) |
| `SHELL_MAX_SESSIONS` | `3` | Sessioni shell concorrenti massime (per processo) |
| `SHELL_RATE_LIMIT_PER_MINUTE` | `5` | Aperture di sessione al minuto, per utente |
| `VITE_API_WS_URL` | *(derivato)* | Override URL WebSocket lato frontend; se assente, derivato da `VITE_API_BASE_URL` (`http`→`ws`, `https`→`wss`) |

### Proxy WebSocket (Docker / nginx)

Dietro nginx (immagine frontend) l'upgrade WebSocket va abilitato per il path
`/api/ws/`, ad esempio:

```nginx
location /api/ws/ {
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
}
```

---

## Sicurezza (predisposizioni già presenti)

- **Nessuna password SSH**: solo autenticazione a chiave; le chiavi stanno in
  `secrets/ssh/` (gitignored) e sono montate in sola lettura nel container.
- **Allowlist comandi** (`backend/app/ssh/allowlist.py`): nessun comando arbitrario
  verrà mai eseguito sui Raspberry.
- **Separazione endpoint**: read-only (`/api/.../` GET) separati dagli endpoint di
  comando (`/api/devices/{id}/commands/...`).
- **Conferma obbligatoria**: i comandi distruttivi richiedono `confirm: true` e una
  modale di conferma lato UI.
- **Audit log**: ogni tentativo di comando viene registrato in `command_audit_logs`.
- **Shell web admin-only**: la shell interattiva (WebSocket + SSH PTY) consente
  comandi arbitrari, quindi è riservata agli admin, disattivabile
  (`SHELL_ENABLED`), con rate limit, limite sessioni, timeout e audit dedicato
  (vedi [Shell web interattiva](#shell-web-interattiva-solo-admin)).
- **Segreti via env**: JWT secret, password admin e path chiavi provengono da `.env`.

### Regole sudoers consigliate sui Raspberry (per le fasi successive)

I comandi privilegiati assumono una configurazione **sudo NOPASSWD ristretta**.
Non usare mai password sudo interattive. Il **blocco completo e aggiornato** (che
copre alimentazione, aggiornamenti, restart servizi, Tailscale, myst e
backup/restore) è documentato sopra in
[⚠️ Configurazione sudoers richiesta sui Raspberry](#-configurazione-sudoers-richiesta-sui-raspberry).

Validare sempre con `visudo -c`. Mantenere l'allowlist il più restrittiva possibile.

---

## Migrazione a PostgreSQL

Il codice usa SQLAlchemy con `DATABASE_URL`. Per passare a Postgres è sufficiente:
1. impostare in `.env`:
   `DATABASE_URL="postgresql+psycopg://user:password@db:5432/raspberry_dashboard"`
2. aggiungere un servizio `db: postgres` in `docker-compose.yml`.

Nessuna modifica al codice applicativo è richiesta.

---

## Test (backend)

```bash
cd backend
pip install -r requirements.txt
pytest
```

---

## Roadmap

- **Fase 2** — MVP monitoraggio: ping/TCP check, stato online/offline, metriche base via SSH. ✅
- **Fase 3** — Metriche avanzate, storico, grafici, alert configurabili. ✅
- **Fase 4** — Comandi remoti sicuri (reboot/shutdown/update/restart) con audit. ✅
- **Fase 5** — Rifinitura UI, dark mode, timeline eventi, test, hardening finale. ✅

> Evoluzioni future opzionali: gestione utenti multipli,
> integrazione Prometheus/Grafana oppure code-splitting per ridurre la dimensione
> del bundle. (Il **terminale SSH web** admin-only è ora disponibile, vedi
> [Shell web interattiva](#shell-web-interattiva-solo-admin).)

> **Nota aggiornamento schema (Fase 1 → 2)**: sono state aggiunte le colonne
> `last_latency_ms` e `consecutive_failures` alla tabella `devices`. Con SQLite in
> sviluppo, se hai già un DB della Fase 1 azzeralo per applicare lo schema:
> `docker compose down -v` (rimuove il volume `backend_data`) e poi
> `docker compose up --build`.

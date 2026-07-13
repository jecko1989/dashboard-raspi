# dashboard-raspi

Dashboard personale per monitorare e gestire più Raspberry Pi via VPN, sviluppata con FastAPI + React.

> Il progetto è pensato per gestire più luoghi (es. appartamenti), ciascuno con uno o più Raspberry Pi connessi tramite Tailscale. Consente di monitorare lo stato dei device, raccogliere metriche di sistema, eseguire comandi remoti e aprire una shell web interattiva — tutto da un'unica interfaccia.

## Stato attuale del progetto (2026-07-14)

- Interfaccia responsive mobile-first (navigazione a drawer su smartphone).
- Milestone v0.8.0 completata: eventi accessibili da pulsante campanella contestuale (overview/luogo/device) con modale dedicata.
- Sidebar semplificata: rimossa la voce ridondante per la creazione diretta device dal menu laterale.
- Dettaglio device semplificato: sezione `Prestazioni` con valori correnti, trend recente per card e pulsante CSV nello stesso box.
- Layout dettaglio device riallineato: box `Dettaglio` e `Prestazioni` affiancati su desktop, sezione `Servizi` senza card separata.
- Deploy operativo in modalità Docker e nativa (systemd) con script dedicati.
- Gestione CORS documentata con troubleshooting pratico in produzione.
- Roadmap funzionale disponibile in `docs/ROADMAP.md`.
- Convenzione di versionamento attiva in `docs/VERSIONING.md`.
- Automazione release/versioning configurata con Release Please su GitHub Actions.
- Template PR e template commit locale presenti per allineare il flusso Git.

Documenti di riferimento rapido:

- `docs/DEPLOYMENT.md` (deploy, rete, CORS)
- `docs/ROADMAP.md` (milestone future)
- `docs/VERSIONING.md` (Conventional Commits, SemVer, release)
- `docs/MILESTONE_WORKFLOW.md` (guida flusso milestone per developer) **← LEGGI QUESTO PRIMA DI FARE PR**
- `CHANGELOG.md` (stato evolutivo e voci Unreleased)

---

## Funzionalità

- Stato online/offline in tempo reale con check TCP e latenza
- Raccolta metriche SSH: CPU, RAM, disco, temperatura, uptime, load average
- Trend recente delle metriche integrato nelle card `Prestazioni` del dettaglio device
- Alert configurabili (temperatura, disco, RAM, CPU, offline, riavvio) con auto-risoluzione
- Comandi remoti sicuri: reboot, shutdown, aggiornamenti, restart servizi
- Stato e log dei servizi systemd (read-only)
- Audit log completo di ogni comando eseguito
- Autenticazione JWT con login locale (bcrypt)
- Shell web interattiva admin-only (WebSocket + SSH PTY, xterm.js)
- Esportazione CSV delle metriche dal box `Prestazioni`
- Aggiunta di nuovi device dalla dashboard (persistiti in `config/devices.yaml`)
- Dark mode, timeline attività, badge VPN/latenza
- Interfaccia responsive mobile-first: navigazione a drawer, griglie e grafici adattivi, tabelle anti-overflow
- Deploy con Docker Compose o esecuzione locale (script PowerShell incluso)
- Script di deploy sul Raspberry (Docker o nativo systemd) via Tailscale o LAN — vedi [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## Stack

| Livello   | Tecnologia |
|-----------|-----------|
| Backend   | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, APScheduler, Paramiko |
| Frontend  | React 18, TypeScript, Vite, Tailwind CSS, React Router, Recharts |
| Database  | SQLite (migrabile a PostgreSQL cambiando solo `DATABASE_URL`) |
| Deploy    | Docker Compose (backend + frontend Nginx); script deploy Docker/nativo per Raspberry ([docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)) |

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
      services/          # logica applicativa
      ssh/               # client SSH + allowlist comandi
      scheduler/         # scheduler raccolta metriche
    tests/
    requirements.txt
    Dockerfile
  frontend/
    src/
      components/
      pages/
      services/          # client API tipizzato
      hooks/
      types/
    package.json
    Dockerfile
  config/
    devices.example.yaml # template versionato
    devices.yaml         # configurazione reale (ignorato da git)
  secrets/ssh/           # chiavi SSH private (mai committare)
  scripts/               # deploy.sh + lib (deploy Docker/nativo)
  deploy/                # deploy.env.example + template systemd
  docs/
    DEPLOYMENT.md        # guida deploy e accesso LAN/Tailscale
    ROADMAP.md           # roadmap funzionale per milestone
    VERSIONING.md        # convenzione commit/versioni/release
  docker-compose.yml
  .env.example
```

---

## Avvio rapido (Docker)

### 1. Prerequisiti

- Docker + Docker Compose

### 2. Configura le variabili d'ambiente

```bash
cp .env.example .env          # Linux/macOS
copy .env.example .env        # Windows
```

Modifica `.env` impostando almeno:

- **`JWT_SECRET_KEY`** — genera un secret casuale robusto:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```
- **`ADMIN_PASSWORD`** — password dell'utente admin (creato una sola volta al primo avvio).
- `VITE_API_BASE_URL` — se il backend non è su `localhost:8000`.

### 3. Configura i device

```bash
cp config/devices.example.yaml config/devices.yaml      # Linux/macOS
copy config\devices.example.yaml config\devices.yaml    # Windows
```

Cerca i marcatori `# MODIFICA QUI` e imposta `ip_vpn`, `hostname`, `ssh.username`, `ssh.port`, `ssh.key_path` e i servizi systemd da monitorare per ogni device.

### 4. Inserisci le chiavi SSH

Copia le chiavi SSH private in `secrets/ssh/` (vedi `secrets/ssh/README.md`) e imposta i permessi a `600`.

### 5. Avvia

```bash
docker compose up --build
```

- **Backend**: <http://localhost:8000> — API docs su `/docs`, health su `/api/health`
- **Frontend**: <http://localhost:8080>

> **Primo accesso**: usa `ADMIN_USERNAME` / `ADMIN_PASSWORD` dal file `.env`.

---

## Esecuzione locale (senza Docker)

Usa questa modalità se Docker non è disponibile.

### Prerequisiti

- **Python 3.12** — obbligatorio.
- **Node.js 20 LTS** + npm.
- (Per metriche reali) VPN attiva + chiavi SSH in `secrets/ssh/`.

Gli script di avvio possono installare automaticamente le dipendenze mancanti (vedi sotto).

### Avvio con script — Windows (PowerShell)

```powershell
.\run-local.ps1                  # prima esecuzione: crea venv, installa dipendenze, avvia
.\run-local.ps1 -SkipInstall     # avvii successivi: più veloce
.\run-local.ps1 -BackendPort 8001 -FrontendPort 5174
```

Lo script apre due finestre PowerShell (backend e frontend). Se le dipendenze non sono installate:

```powershell
.\run-local.ps1 -InstallPython             # installa Python 3.12 via winget
.\run-local.ps1 -InstallNode               # installa Node.js LTS via winget
.\run-local.ps1 -InstallPython -InstallNode   # entrambi in un colpo solo
```

**Login locale**: `admin` / `admin` (impostato dallo script per sviluppo).

Se PowerShell blocca l'esecuzione degli script:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Avvio con script — Linux / macOS (Bash)

```bash
chmod +x run-local.sh            # solo la prima volta
./run-local.sh                   # prima esecuzione: crea venv, installa dipendenze, avvia
./run-local.sh --skip-install    # avvii successivi: più veloce
./run-local.sh --backend-port 8001 --frontend-port 5174
```

Lo script avvia backend e frontend in background nella stessa sessione; Ctrl+C li ferma entrambi. Se le dipendenze non sono installate:

```bash
./run-local.sh --install-python            # installa Python 3.12 (apt/dnf/brew)
./run-local.sh --install-node              # installa Node.js LTS via nvm
./run-local.sh --install-python --install-node   # entrambi in un colpo solo
```

> `--install-python` usa il gestore di pacchetti di sistema (`apt` su Ubuntu/Debian, `dnf` su Fedora, `brew` su macOS).  
> `--install-node` installa [nvm](https://github.com/nvm-sh/nvm) se assente, poi installa l'LTS corrente con `nvm install --lts`.

**Login locale**: `admin` / `admin` (impostato dallo script per sviluppo).

### Avvio manuale

**Backend** (terminale 1):

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Crea `backend/.env` con i percorsi locali:

```dotenv
DATABASE_URL="sqlite:///./raspberry_dashboard.db"
DEVICES_CONFIG_PATH="..\config\devices.yaml"
SSH_KEYS_DIR="..\secrets\ssh"
CORS_ORIGINS="http://localhost:5173"
JWT_SECRET_KEY="un_valore_casuale_qualsiasi_per_sviluppo"
```

```powershell
uvicorn app.main:app --reload --port 8000
```

**Frontend** (terminale 2):

```powershell
cd frontend
npm install
npm run dev
```

Frontend su <http://localhost:5173>.

Nota sviluppo locale: `run-local.ps1` genera un `JWT_SECRET_KEY` casuale se non già impostato. Dopo ogni riavvio del backend, eventuali token JWT salvati nel browser diventano invalidi e il frontend può ricevere `401` finché non si effettua un nuovo login.

---

## Deploy su Raspberry (LAN / Tailscale)

Per distribuire la dashboard su un Raspberry Pi raggiungibile via **Tailscale** o
**rete locale** sono inclusi script di deploy generici (nessun dato personale
viene committato):

```bash
cp deploy/deploy.env.example deploy/deploy.env   # poi personalizza host/porte
./scripts/deploy.sh --mode docker --dry-run      # prova a secco
./scripts/deploy.sh --mode docker                # deploy con Docker Compose
./scripts/deploy.sh --mode native                # deploy nativo con systemd
```

Guida completa (binding `0.0.0.0`, `VITE_API_BASE_URL`, CORS, firewall, accesso
LAN e Tailscale/MagicDNS): **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

Note pratiche per il deploy `native`:

- su **Windows** puoi lanciare gli script da **Git Bash**; se `rsync` non e'
  affidabile, il deploy usa automaticamente un fallback `tar+ssh`
- `SERVICE_USER` in `deploy.env` deve essere un utente gia' esistente sul Raspberry
- il deploy `native` richiede `sudo` non interattivo almeno per `install` e
  `systemctl`
- se servi il frontend con `nginx` da un path sotto `/home/<utente>`, assicurati
  che il web server possa attraversare la home oppure usa un path fuori da `/home`
- il repo include un template `nginx` in `deploy/nginx/dashboard-raspi.conf`

---

## Configurazione

### `config/devices.yaml`

Struttura dei luoghi e dei device. È ignorato da git (usa `devices.example.yaml` come template).

Campi principali per ogni device:

| Campo | Descrizione |
|-------|-------------|
| `ip_vpn` | IP VPN reale del Raspberry |
| `hostname` | Hostname del device |
| `ssh.username` | Utente SSH |
| `ssh.port` | Porta SSH (default `22`) |
| `ssh.key_path` | Path della chiave privata in `secrets/ssh/` |
| `services` | Servizi systemd da monitorare |
| `thresholds` | Soglie alert per device (opzionale, sovrascrive i globali) |

**Soglie alert globali** (sezione `thresholds` del file):

| Soglia | Default | Alert |
|--------|---------|-------|
| `temperature_celsius` | 70 | Temperatura CPU troppo alta |
| `disk_percent` | 85 | Disco quasi pieno |
| `ram_percent` | 85 | RAM elevata |
| `cpu_percent` | 90 | CPU elevata |
| `offline_after_failures` | 3 | Device offline dopo N check falliti |

### File `.env`

| Modalità | Percorso | Come crearlo |
|----------|----------|--------------|
| Docker | `dashboard-raspi/.env` | `cp .env.example .env` |
| Locale | `backend/.env` | `cp .env.example backend/.env` |

---

## Sicurezza

- **Nessuna password SSH**: solo autenticazione a chiave; le chiavi stanno in `secrets/ssh/` (gitignored) e sono montate in sola lettura nel container.
- **Allowlist comandi** (`backend/app/ssh/allowlist.py`): nessun comando arbitrario viene eseguito sui Raspberry; ogni comando deve essere esplicitamente dichiarato nell'allowlist.
- **Separazione endpoint**: read-only (GET) separati dagli endpoint di comando.
- **Conferma obbligatoria**: i comandi distruttivi richiedono `confirm: true` e una modale di conferma lato UI.
- **Audit log**: ogni tentativo di comando viene registrato in `command_audit_logs`.
- **Shell web admin-only**: è l'unica eccezione all'allowlist — riservata agli admin, disattivabile con `SHELL_ENABLED=false`, con rate limit, limite sessioni, timeout e audit dedicato.
- **Segreti via env**: JWT secret, password admin e path chiavi provengono sempre da `.env`.

### Configurazione sudoers richiesta sui Raspberry

I comandi privilegiati assumono una configurazione **sudo NOPASSWD ristretta**. Crea `/etc/sudoers.d/dashboard-raspi` sul Raspberry (con `sudo visudo -f /etc/sudoers.d/dashboard-raspi`), sostituendo `pi` con l'utente SSH effettivo:

```sudoers
# Alimentazione
pi ALL=(root) NOPASSWD: /sbin/reboot
pi ALL=(root) NOPASSWD: /sbin/shutdown -h now

# Aggiornamenti di sistema
pi ALL=(root) NOPASSWD: /usr/bin/apt-get update
pi ALL=(root) NOPASSWD: /usr/bin/apt-get -y upgrade
pi ALL=(root) NOPASSWD: /usr/bin/apt-get -s upgrade

# Restart servizi (solo quelli che intendi gestire)
pi ALL=(root) NOPASSWD: /bin/systemctl restart ssh
pi ALL=(root) NOPASSWD: /bin/systemctl restart cron

# Tailscale
pi ALL=(root) NOPASSWD: /usr/bin/tailscale set *

# Mysterium Node
pi ALL=(root) NOPASSWD: /bin/systemctl start mysterium-node
pi ALL=(root) NOPASSWD: /bin/systemctl stop mysterium-node
pi ALL=(root) NOPASSWD: /bin/systemctl restart mysterium-node

# Backup/restore Mysterium
pi ALL=(root) NOPASSWD: /usr/bin/tar -czf - -C /var/lib/mysterium-node .
pi ALL=(root) NOPASSWD: /usr/bin/tar -xzf - -C /var/lib/mysterium-node
pi ALL=(root) NOPASSWD: /usr/bin/chown -R mysterium-node /var/lib/mysterium-node
```

`systemctl is-active` e `journalctl` **non** richiedono sudo. Valida con `sudo visudo -c`.

> I percorsi assoluti nelle regole sudoers devono corrispondere esattamente a quelli in `backend/app/ssh/allowlist.py`. Su Ubuntu recente `/bin` e `/sbin` sono symlink verso `/usr/bin`/`/usr/sbin`: verifica con `sudo -n -l`.

---

## Shell web interattiva (solo admin)

Dal dettaglio device, un utente admin può aprire una shell interattiva sul Raspberry direttamente dal browser (xterm.js via WebSocket → SSH PTY).

- **Endpoint**: `WS /api/ws/devices/{id}/shell?token=<JWT>&cols=<n>&rows=<n>`
- **Autenticazione**: JWT in query string (i WebSocket browser non inviano header `Authorization`); l'accesso richiede `is_admin`.
- **Protocollo**: il client invia JSON `{"type":"input","data":"…"}` e `{"type":"resize","cols":n,"rows":n}`; il server risponde con frame binari (output terminale).

### Variabili d'ambiente

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `SHELL_ENABLED` | `true` | Abilita/disabilita globalmente la shell web |
| `SHELL_SESSION_TIMEOUT_SECONDS` | `1800` | Durata massima di una sessione |
| `SHELL_IDLE_TIMEOUT_SECONDS` | `300` | Chiusura automatica dopo inattività |
| `SHELL_MAX_SESSIONS` | `3` | Sessioni concorrenti massime |
| `SHELL_RATE_LIMIT_PER_MINUTE` | `5` | Aperture al minuto per utente |
| `VITE_API_WS_URL` | *(derivato)* | Override URL WebSocket; se assente, derivato da `VITE_API_BASE_URL` (`http`→`ws`, `https`→`wss`) |

### Proxy WebSocket (Docker / nginx)

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

## Migrazione a PostgreSQL

Il codice usa SQLAlchemy con `DATABASE_URL`. Per passare a Postgres:

1. Imposta in `.env`:
   ```dotenv
   DATABASE_URL="postgresql+psycopg://user:password@db:5432/raspberry_dashboard"
   ```
2. Aggiungi un servizio `db: postgres` in `docker-compose.yml`.

Nessuna modifica al codice applicativo è richiesta.

---

## Test (backend)

```bash
cd backend
pip install -r requirements.txt
pytest
```

---

## Changelog

Vedi [CHANGELOG.md](CHANGELOG.md) per il dettaglio delle funzionalità aggiunte in ogni fase di sviluppo.

---

## File sensibili — cosa non finisce su GitHub

| File / cartella | Motivo |
|---|---|
| `.env`, `*.env` | Segreti: `JWT_SECRET_KEY`, `ADMIN_PASSWORD`, ecc. |
| `secrets/ssh/id_*`, `*.key`, `*.pem` | Chiavi SSH private dei Raspberry |
| `config/devices.yaml` | IP/hostname reali (usa `devices.example.yaml`) |
| `*.db`, `*.sqlite*`, `data/` | Database con utenti e audit |
| `.venv/`, `__pycache__/`, `node_modules/`, `dist/` | Ambienti e build locali |

I file template versionati sono: `.env.example`, `config/devices.example.yaml`, `secrets/ssh/README.md`.

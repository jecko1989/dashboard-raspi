# Changelog

## [0.2.1](https://github.com/jecko1989/dashboard-raspi/compare/v0.2.0...v0.2.1) (2026-07-12)


### Bug Fixes

* **ci:** aggiorna actions a versioni Node.js 24 native ([5eee6b5](https://github.com/jecko1989/dashboard-raspi/commit/5eee6b55ae48000c0ca3a64e4a3e32ad4a9d2ca5))

## [0.2.0](https://github.com/jecko1989/dashboard-raspi/compare/v0.1.4...v0.2.0) (2026-07-12)


### Features

* **ci:** applica approccio 1 per release selective + fixa versione action ([f942732](https://github.com/jecko1989/dashboard-raspi/commit/f942732e7de79b823f24b7499b6e56520cec94f5))


### Bug Fixes

* **ci:** calcolo manuale del bump nel workflow, ignora commit non-release ([e6acfc8](https://github.com/jecko1989/dashboard-raspi/commit/e6acfc877b216d2559d61e2651dedf1c23ba6288))
* **ci:** Release Please esegue sempre, commit-skip gestisce il bump ([2d2aa3b](https://github.com/jecko1989/dashboard-raspi/commit/2d2aa3b36c9473ce696da1bcd096ca72a9a6a4c2))
* **ci:** semplifica script bash per calcolo bump - rimuove regex complicate ([7de6e6e](https://github.com/jecko1989/dashboard-raspi/commit/7de6e6ee282ae58ff3a4a44916e61d55482bb673))
* **release:** configura Release Please per ignorare commit type non-release nel bump ([3dabce3](https://github.com/jecko1989/dashboard-raspi/commit/3dabce33ff28412c8c3af96e8e7b805e0424486f))
* **release:** rimuove bump-patch-for-minor-pre-major che causava PATCH errati ([730bfb3](https://github.com/jecko1989/dashboard-raspi/commit/730bfb3be5ecf5c4e38b4d66661986bc3dc47666))

## [0.1.4](https://github.com/jecko1989/dashboard-raspi/compare/v0.1.3...v0.1.4) (2026-07-12)


### Bug Fixes

* **ci:** release-please passa target-version solo se milestone è presente ([bd41563](https://github.com/jecko1989/dashboard-raspi/commit/bd41563b4743937718c45687de518403ce7cc76c))

## [0.1.3](https://github.com/jecko1989/dashboard-raspi/compare/v0.1.2...v0.1.3) (2026-07-12)


### Features

* **ci:** implementa milestone workflow automatico con Release Please ([5e88364](https://github.com/jecko1989/dashboard-raspi/commit/5e8836473037089d4f48ca8d4ef8cf6bc007f213))

## [0.1.2](https://github.com/jecko1989/dashboard-raspi/compare/v0.1.1...v0.1.2) (2026-07-11)


### Features

* **ui:** rendi responsive le viste principali per mobile ([98d50e2](https://github.com/jecko1989/dashboard-raspi/commit/98d50e2e1147b5f0846d22a4a1ffaf8ae884f1b8))

## [0.1.1](https://github.com/jecko1989/dashboard-raspi/compare/v0.1.0...v0.1.1) (2026-07-11)


### Features

* add allowScripts configuration for esbuild ([990c09d](https://github.com/jecko1989/dashboard-raspi/commit/990c09d219770716924126b35be8eb6c162e3c61))
* add interactive web shell for admin users ([3367852](https://github.com/jecko1989/dashboard-raspi/commit/3367852297f54939f04ceb677c87e51ae9afb50e))
* aggiunto changelog con dettagli sulle funzionalità delle fasi di sviluppo ([1bdf857](https://github.com/jecko1989/dashboard-raspi/commit/1bdf85716c15ddd353b15a069c757b0a444fa2d7))
* **devices:** implement device creation flow ([528b4f8](https://github.com/jecko1989/dashboard-raspi/commit/528b4f8e6e1d24b846fae9e3631bfeb39580b1e4))
* **scripts:** add multi-platform local run scripts with automatic dependency installation ([75a08ae](https://github.com/jecko1989/dashboard-raspi/commit/75a08ae0f8d4cb4829c2913dd7b60c764591a060))
* **ui:** add sidebar emojis and device creation entry ([4c24ce0](https://github.com/jecko1989/dashboard-raspi/commit/4c24ce0f89ae2a8a8d17a826ac8338c5636abcd6))


### Bug Fixes

* **ci:** aggiorna release-please e documenta permessi Actions ([24c7c5e](https://github.com/jecko1989/dashboard-raspi/commit/24c7c5ecea1b5d191262dece516ddbef19c3dd0c))
* **tsconfig:** add missing device create page to project root ([42a6448](https://github.com/jecko1989/dashboard-raspi/commit/42a644889aef9ed86240c6dbcbef001f8f6b6777))

## Changelog

Questo file segue una struttura compatibile con Keep a Changelog.
Le versioni usano Semantic Versioning (`MAJOR.MINOR.PATCH`) con tag Git `vX.Y.Z`.

## Unreleased

- **UX mobile**: viste principali rese responsive (mobile-first). Navigazione con drawer + hamburger su schermi piccoli (`Layout`, `Sidebar`), griglia metriche adattiva (`grid-cols-2 sm:grid-cols-3`), grafici ad altezza dinamica (`MetricChart`), tabelle con scroll anti-overflow (`ServiceStatusTable`), header e pagine core (`Overview`, `DeviceDetailPage`, `AlertsPage`, `Settings`) fluidi su viewport 360-430 px.
- Documentazione di progetto allineata con stato corrente (roadmap, versioning, deploy).
- Aggiunta roadmap milestone-based in `docs/ROADMAP.md`.
- Aggiunta guida `docs/VERSIONING.md` con Conventional Commits + SemVer.
- Configurata automazione release/versioning con Release Please:
  - `.github/workflows/release-please.yml`
  - `release-please-config.json`
  - `.release-please-manifest.json`
- Aggiunti template di collaborazione Git:
  - `.gitmessage.txt` (commit template)
  - `.github/pull_request_template.md` (PR checklist)
- Aggiornata guida deploy con troubleshooting CORS in login/preflight.

---

## Extra — Script locali multi-piattaforma

- **`run-local.sh`** (Linux/macOS): equivalente bash di `run-local.ps1`. Avvia backend e frontend in background nella stessa sessione terminale; Ctrl+C li ferma entrambi. Supporta `--skip-install`, `--backend-port`, `--frontend-port`, `--install-python` (apt/dnf/brew) e `--install-node` (nvm).
- **`run-local.ps1 -InstallNode`**: installa Node.js LTS tramite `winget install OpenJS.NodeJS.LTS` e aggiorna il PATH nella sessione corrente. In precedenza Node mancante causava un errore diretto senza possibilità di auto-installazione.

---

## Extra — Gestione device e deploy automatico

- **Aggiunta device dalla dashboard**: voce di sidebar "➕ Aggiungi device" e form dedicato (`/devices/new`). `POST /api/devices` valida i dati, gestisce hostname/IP duplicati (409) e appartamento inesistente (404), persiste il device in `config/devices.yaml` (fonte di verità) e sincronizza il DB. I campi runtime (online, latenza, ultima verifica) restano gestiti dal monitoraggio.
- **Emoji nella sidebar** (Overview, Alert, appartamenti, Impostazioni): decorative e accessibili (`aria-hidden`).
- **Deploy su Raspberry**: script generici `scripts/deploy.sh` (Docker e nativo systemd) via Tailscale o LAN, con `--dry-run`, health check e rollback (modalità nativa). Config di esempio in `deploy/deploy.env.example`, template systemd in `deploy/systemd/`.
- **Guida deploy/accesso**: `docs/DEPLOYMENT.md` (binding `0.0.0.0`, `VITE_API_BASE_URL`, CORS, firewall, LAN, Tailscale/MagicDNS).
- Porte del compose parametrizzabili (`FRONTEND_PORT`/`BACKEND_PORT`, default invariati).

---

## Fase 5 — Rifinitura finale

- **Autenticazione completa**: login locale username/password, password hashata bcrypt, JWT Bearer. Tutti gli endpoint (tranne `/api/health` e `/api/auth/login`) sono protetti.
  - `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
  - Rate limiting anti brute-force sul login
  - L'utente che esegue un comando viene registrato in audit (`requested_by`)
- **Utente admin** creato automaticamente all'avvio da `ADMIN_USERNAME` / `ADMIN_PASSWORD` (`.env`).
- **Esportazione CSV** delle metriche: `GET /api/devices/{id}/metrics/export.csv` e pulsante "Esporta CSV" nel dettaglio device.
- Rifiniture UI: login page, logout e username nell'header, badge VPN/latenza sulle card, timeline attività nella overview, dark mode.
- **Healthcheck** Docker sul backend; il frontend parte solo quando il backend è `healthy`.
- **Shell web interattiva** admin-only (WebSocket + SSH PTY, xterm.js): terminale interattivo sul Raspberry direttamente dal browser.
- Test: parser metriche, soglie, allowlist/anti-injection, sicurezza (hash + JWT).

---

## Fase 4 — Comandi remoti sicuri

- **Comandi remoti** eseguiti via SSH, tutti passanti dall'allowlist:
  - `POST /api/devices/{id}/commands/reboot`
  - `POST /api/devices/{id}/commands/shutdown`
  - `POST /api/devices/{id}/commands/update` (con `dry_run: true` per simulare)
  - `POST /api/devices/{id}/services/{name}/restart`
- **Stato servizi** e **log** (read-only via SSH):
  - `GET /api/devices/{id}/services`
  - `GET /api/devices/{id}/services/{name}/logs`
- **Conferma obbligatoria**: gli endpoint richiedono `confirm: true`; il frontend mostra una modale di conferma per le azioni distruttive.
- **Rate limiting** per client IP sugli endpoint di comando (`COMMAND_RATE_LIMIT_PER_MINUTE`, default 10/min → HTTP 429 se superato).
- **Audit log** completo di ogni comando (pending → success/error/denied): `GET /api/audit`.
- Separazione netta: endpoint di comando nel router `commands`, distinti dai read-only.
- Frontend: pannello comandi nel dettaglio device, tabella servizi con restart e visualizzazione log, banner con esito del comando.

---

## Fase 3 — Metriche avanzate, storico, alert

- **Storico metriche** persistito e **grafici** (CPU, RAM, disco, temperatura) nella pagina di dettaglio device (Recharts).
- **Alert configurabili** generati automaticamente dal ciclo di monitoraggio:
  - `offline`, `temperature`, `disk`, `ram`, `cpu`, `reboot` (rilevato da calo dell'uptime)
  - Gli alert si **risolvono automaticamente** quando la condizione rientra.
- **Soglie configurabili** in `config/devices.yaml` (globali + override per device).
- **Pagina Alert** e **timeline eventi** nel frontend.
- **Silenziamento alert per device** (mute/unmute): `POST /api/devices/{id}/alerts/mute` e `.../unmute`
- `GET /api/alerts` (filtro `active_only`), `GET /api/settings/thresholds`
- **Pagina Impostazioni** con le soglie correnti.

---

## Fase 2 — MVP monitoraggio

- `GET /api/health` → `{"status": "ok"}`
- Appartamenti e device caricati da `config/devices.yaml` e sincronizzati nel DB.
- `GET /api/apartments`, `GET /api/devices`, `GET /api/devices/{id}`
- **Stato online/offline reale** via check TCP sulla porta SSH, con **latenza** (ms).
- Logica *offline dopo N fallimenti consecutivi* (soglia in `devices.yaml`).
- **Raccolta metriche base via SSH**: CPU, RAM, disco, temperatura, uptime, load average, versione OS, kernel.
- `GET /api/devices/{id}/metrics/latest` e `.../metrics/history`
- Registrazione **eventi** sul cambio di stato → `GET /api/events`
- **Scheduler** che esegue il ciclo di monitoraggio ogni `METRICS_INTERVAL_SECONDS`.
- Refresh manuale: `POST /api/monitoring/refresh`, `POST /api/devices/{id}/check`
- Frontend: overview con "Aggiorna tutto", dettaglio device con metriche reali, latenza, dark mode.

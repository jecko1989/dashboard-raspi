# Changelog

Tutte le funzionalità aggiunte per fase di sviluppo.

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

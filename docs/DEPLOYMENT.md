# Deployment e accesso — RPi Dashboard

Guida al deploy della dashboard su un Raspberry Pi e all'accesso da **rete locale
(LAN)** e da **Tailscale**. Gli script di deploy sono in [`scripts/`](../scripts)
e la configurazione di esempio in [`deploy/deploy.env.example`](../deploy/deploy.env.example).

> Tutti gli indirizzi in questa guida sono **esempi**. Sostituiscili con quelli
> reali del tuo ambiente. Non committare mai IP, hostname, chiavi o segreti reali.

---

## 1. Ambienti a confronto

| Ambiente | Come giri | Come accedi |
|----------|-----------|-------------|
| **Sviluppo (locale)** | `run-local.ps1` oppure `npm run dev` + uvicorn | `http://localhost:5173` (Vite) / API su `http://localhost:8000` |
| **Sviluppo in Docker** | `docker compose up --build` sul tuo PC | Frontend `http://localhost:8080`, backend `http://localhost:8000` |
| **Produzione sul Raspberry** | `./scripts/deploy.sh --mode docker|native` | Dal Raspberry stesso: `http://localhost:8080`. Da altri dispositivi: IP/hostname del Pi |

Concetto chiave: **`localhost` indica sempre il dispositivo su cui è aperto il
browser**, non il Raspberry remoto. Da un altro PC/telefono devi usare l'indirizzo
del Raspberry (LAN o Tailscale), non `localhost`.

Modi per raggiungere il Raspberry in produzione:

- **IP LAN** — es. `http://192.168.1.50:8080`
- **Hostname LAN** — es. `http://rpi-dashboard.local:8080` (se hai mDNS/avahi)
- **IP Tailscale** — es. `http://100.64.0.10:8080`
- **MagicDNS (Tailscale)** — es. `http://rpi-dashboard:8080` oppure
  `http://rpi-dashboard.example-tailnet.ts.net:8080`

---

## 2. Prerequisiti

**Sul tuo PC (da cui lanci il deploy):**
- `ssh`
- `rsync` su Linux/macOS; su Windows gli script possono usare il fallback `tar+ssh`
- accesso SSH **a chiave** al Raspberry (niente password)
- per la modalità nativa: `node` e `npm` (build del frontend)

Su **Windows** puoi lanciare `deploy.sh` da **Git Bash**: gli script provano a
usare OpenSSH nativo di Windows e, se necessario, fanno il trasferimento file
via `tar+ssh` invece di `rsync`.

**Sul Raspberry:**
- **Docker**: Docker Engine + plugin **Docker Compose V2** (`docker compose`)
- **Nativo**: `python3`, `python3-venv`, `systemd`, `sudo` (idealmente NOPASSWD
  ristretto per `systemctl`/`install`), e un web server statico (es. `nginx`) per
  servire il frontend

Per la modalità **native** gli script ora verificano esplicitamente che `sudo`
sia usabile in modo **non interattivo** per i comandi necessari al deploy. Se il
tuo utente SSH non ha già questi permessi, configura una regola `sudoers`
mirata prima del primo deploy.

Gli script **non installano** pacchetti di sistema: se manca qualcosa, si fermano
e indicano cosa installare (es. `sudo apt-get install -y python3 python3-venv`).

---

## 3. Configurazione

1. Copia e personalizza la configurazione di deploy (il file reale è gitignored):

   ```bash
   cp deploy/deploy.env.example deploy/deploy.env
   ```

   Imposta almeno `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, le porte e
   `HEALTHCHECK_URL`. Per la modalità **native**, valuta di impostare anche
   `NGINX_CONF_PATH` per fare in modo che il deploy aggiorni e ricarichi nginx
   automaticamente.

2. **Sul Raspberry**, prepara i file che gli script **non** trasferiscono (per
   sicurezza restano solo sul Pi e non vengono mai sovrascritti dal deploy):

   ```text
   ${DEPLOY_PATH}/.env                    # variabili backend (da .env.example)
   ${DEPLOY_PATH}/config/devices.yaml     # da config/devices.example.yaml
   ${DEPLOY_PATH}/secrets/ssh/            # chiavi SSH verso i device (0600)
   ```

   Il deploy avvisa con un warning se `.env` o `config/devices.yaml` mancano.

    Se usi la modalità **native**, dentro `${DEPLOY_PATH}/.env` non lasciare i
    path di default pensati per Docker (`/data`, `/secrets`, `/config`). Usa path
    reali sul Raspberry, ad esempio:

    ```bash
    DATABASE_URL="sqlite:////home/<utente>/workspace/dashboard-raspi/raspberry_dashboard.db"
    SSH_KEYS_DIR="/home/<utente>/workspace/dashboard-raspi/secrets/ssh"
    DEVICES_CONFIG_PATH="/home/<utente>/workspace/dashboard-raspi/config/devices.yaml"
    ```

    Se `${DEPLOY_PATH}` e il frontend statico stanno sotto `/home/<utente>/...`, il
    web server deve poter **attraversare** tutte le directory padre. Con `nginx`
    su Ubuntu può servire almeno il bit `x` per gli altri utenti sulla home, ad
    esempio `chmod o+x /home/<utente>`, oppure in alternativa puoi scegliere un
    `DEPLOY_PATH` fuori dalla home (es. `/opt/...` o `/srv/...`).

---

## 4. SSH e `known_hosts`

Gli script usano SSH **solo a chiave**, in `BatchMode` (nessun prompt password) e
**non** disabilitano mai la verifica dell'host key (nessun
`StrictHostKeyChecking=no`). Prima del primo deploy aggiungi il Raspberry ai tuoi
`known_hosts`:

```bash
# Recupera e verifica la fingerprint dell'host, poi aggiungila.
ssh-keyscan -p 22 rpi-dashboard >> ~/.ssh/known_hosts
```

In alternativa, connettiti una volta manualmente (`ssh deploy@rpi-dashboard`) e
conferma la fingerprint. Per una verifica stretta con un file dedicato, valorizza
`SSH_KNOWN_HOSTS_FILE` in `deploy.env`.

---

## 5. Deploy in modalità Docker

```bash
# Prova a secco (mostra le azioni senza eseguirle):
./scripts/deploy.sh --mode docker --dry-run

# Deploy reale:
./scripts/deploy.sh --mode docker --env-file deploy/deploy.env
```

Cosa fa: verifica Docker + Compose V2 sul Pi, trasferisce il progetto via rsync
(senza segreti), esegue `docker compose up -d --build --remove-orphans` (i volumi
persistenti **non** vengono toccati) e infine un health check.

---

## 6. Deploy in modalità nativa (systemd)

```bash
./scripts/deploy.sh --mode native --env-file deploy/deploy.env
```

Cosa fa: builda il frontend, trasferisce backend e `dist/` in
`${DEPLOY_PATH}/releases/<timestamp>`, aggiorna il symlink `current`, crea il
virtualenv del backend, installa/riavvia la unit systemd e fa l'health check con
**rollback** automatico alla release precedente in caso di fallimento.

Il servizio systemd serve il **backend** (uvicorn su `0.0.0.0:${BACKEND_PORT}`). Il
**frontend statico** (`${DEPLOY_PATH}/current/frontend`) va servito da nginx. Nel
repo è incluso un template pronto in
[`deploy/nginx/dashboard-raspi.conf`](../deploy/nginx/dashboard-raspi.conf) che
**fa il proxy di `/api` al backend**: in questo modo il frontend usa URL relativi
(`/api`) e gira su qualsiasi indirizzo senza bisogno di `VITE_API_BASE_URL`.

```nginx
server {
  listen 8080;
  server_name _;
  root /home/deploy/workspace/dashboard-raspi/current/frontend;

  # Proxy WebSocket (shell web)
  location /api/ws/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600;
  }

  # Proxy REST API al backend
  location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location / {
    try_files $uri $uri/ /index.html;   # fallback SPA per il routing client
  }
}
```

Il template reale in `deploy/nginx/dashboard-raspi.conf` usa segnaposto
(`__FRONTEND_PORT__`, `__DEPLOY_PATH__`, `__BACKEND_PORT__`) che lo script di
deploy sostituisce automaticamente. Se imposti `NGINX_CONF_PATH` in `deploy.env`,
lo script installa il config e ricarica nginx senza intervento manuale.

In alternativa, per installarlo manualmente sul Raspberry:

```bash
sudo install -m 0644 deploy/nginx/dashboard-raspi.conf /etc/nginx/sites-available/dashboard-raspi
sudo ln -sfn /etc/nginx/sites-available/dashboard-raspi /etc/nginx/sites-enabled/dashboard-raspi
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

La unit richiede `sudo` sul Pi per `systemctl` e per installare il file in
`/etc/systemd/system/`. Comandi utili:

```bash
systemctl status rpi-dashboard
sudo journalctl -u rpi-dashboard -n 100 --no-pager
```

`SERVICE_USER` in `deploy.env` deve corrispondere a un utente gia' esistente sul
Raspberry. Se non hai creato un utente dedicato al servizio, usa lo stesso
utente del deploy SSH.

Per evitare prompt password durante il deploy `native`, una configurazione minima
di `sudoers` puo' essere simile a questa:

```sudoers
<utente-deploy> ALL=(root) NOPASSWD: /usr/bin/install, /usr/bin/systemctl, /usr/sbin/nginx, /usr/bin/tee, /usr/bin/ln
```

Installa la regola in modo sicuro con `visudo` oppure creando un file dedicato in
`/etc/sudoers.d/` con permessi `0440`.

Nota: queste regole coprono il **deploy nativo**. Per i comandi operativi della
dashboard (reboot/update/myst/tailscale/ventola) servono anche le regole runtime
documentate in [README.md](../README.md). In particolare, per il controllo
ventola installa l'helper dedicato:

```bash
sudo install -m 0755 deploy/scripts/dashboard-fan-control.sh /usr/local/sbin/dashboard-fan-control
```

e aggiungi in sudoers:

```sudoers
<utente-ssh-dashboard> ALL=(root) NOPASSWD: /usr/local/sbin/dashboard-fan-control pwm
<utente-ssh-dashboard> ALL=(root) NOPASSWD: /usr/local/sbin/dashboard-fan-control fixed *
```

---

## 7. Binding: `0.0.0.0` vs `127.0.0.1`

In **produzione** il backend deve ascoltare su `0.0.0.0` (tutte le interfacce), non
solo su `127.0.0.1`/`localhost`, altrimenti è raggiungibile solo dal Raspberry
stesso.

- **Docker**: il backend parte già con `uvicorn ... --host 0.0.0.0` (vedi
  [`backend/Dockerfile`](../backend/Dockerfile)).
- **Nativo**: la unit systemd usa `--host 0.0.0.0` (vedi
  [`deploy/systemd/rpi-dashboard.service.template`](../deploy/systemd/rpi-dashboard.service.template)).

Non modificare il binding dell'ambiente di **sviluppo**: lì `localhost` va bene.

---

## 8. Come il frontend trova il backend

Il frontend usa **URL relativi** (`/api`): non ha indirizzi IP o hostname nel
bundle (vedi [`frontend/src/services/api.ts`](../frontend/src/services/api.ts)).
nginx (sia nel container Docker sia in modalità native) fa da **proxy** e
instrada le richieste `/api` al backend.

Vantaggi pratici:

- Lo stesso bundle gira su qualsiasi indirizzo (LAN, Tailscale, localhost) **senza
  doverlo ricompilare**.
- Non esiste più `VITE_API_BASE_URL` da impostare nel deploy.
- Frontend e backend risultano sulla **stessa origine** per il browser, quindi il
  CORS è meno rilevante (vedi §9).

`VITE_API_BASE_URL` è deprecata e ignorata. Se presente in un `deploy.env`
esistente, non causa errori ma non ha effetto.

---

## 9. CORS

Con nginx che fa da proxy (`/api → backend`) il browser vede frontend e backend
sulla **stessa origine**: gli errori CORS sulla dashboard spariscono. Il CORS è
comunque configurato nel backend per compatibilità con sviluppo locale (Vite su
`localhost:5173` chiama direttamente il backend su `:8000`).

Il backend legge le origini consentite da **`CORS_ORIGINS`** (lista separata da
virgola, in `.env`; vedi [`backend/app/core/config.py`](../backend/app/core/config.py)).

Per lo sviluppo locale il valore di default (`http://localhost:5173`) è
sufficiente. In produzione, se accedi al backend **direttamente** (es. dalla
pagina `/docs` di FastAPI su `:8000` o da strumenti esterni), aggiungi l'origine:

```bash
CORS_ORIGINS="http://192.168.1.50:8080,http://rpi-dashboard:8080"
```

Attenzione:
- **Non usare `*`** insieme alle credenziali: è insicuro e non ammesso dai browser.
- Elenca solo le origini davvero necessarie (LAN e/o Tailscale).
- L'origine include schema, host **e porta** (es. `http://rpi-dashboard:8080`).

### 9.1 Troubleshooting rapido errore CORS in login

### 9.1 Troubleshooting errore CORS (sviluppo locale)

In sviluppo locale Vite gira su `localhost:5173` e chiama il backend su `:8000`
direttamente (origini diverse). Se in console vedi errori CORS, verifica che in
`backend/.env` il valore includa l'origine del frontend:

```bash
CORS_ORIGINS="http://localhost:5173"
```

In produzione (Docker o native) le chiamate passano da nginx sulla stessa
origine, quindi gli errori CORS non devono comparire. Se compaiono comunque,
controlla che nginx stia girando e che il proxy `/api` sia configurato
correttamente (es. test con `curl http://localhost:8080/api/health`).

Nota: in modalita' native il backend legge CORS da `${DEPLOY_PATH}/.env`
(EnvironmentFile della unit systemd), quindi modificare file locali del repo non
basta senza aggiornare quel file sul Raspberry e riavviare il servizio.

---

## 10. Docker: esporre la porta su tutte le interfacce

In [`docker-compose.yml`](../docker-compose.yml) le porte sono pubblicate senza
prefisso `127.0.0.1`, quindi su tutte le interfacce:

```yaml
ports:
  - "${FRONTEND_PORT:-8080}:80"     # frontend
  - "${BACKEND_PORT:-8000}:8000"    # backend/API
```

**Evita** binding come `127.0.0.1:8080:80`, che renderebbero l'app raggiungibile
solo dal Raspberry — a meno che tu non metta davanti un reverse proxy intenzionale.

---

## 11. Firewall (diagnostica, senza applicare nulla)

Comandi utili sul Raspberry per capire cosa è in ascolto e come raggiungerlo.
**Non applicare regole automaticamente**: valuta prima il tuo scenario.

```bash
hostname -I                 # IP locali del Raspberry
tailscale ip -4             # IP Tailscale (100.x)
tailscale status            # stato mesh / peer raggiungibili
ss -lntp                    # porte in ascolto (8000, 8080, ...)
systemctl status rpi-dashboard
docker compose ps           # (in ${DEPLOY_PATH}) stato container
curl http://localhost:8080  # frontend risponde localmente?
curl http://localhost:8000/api/health   # health backend
```

Se usi **UFW**, esempi (da adattare, esegui tu manualmente):

```bash
sudo ufw status verbose
sudo ufw allow 8080/tcp                       # apre la porta a tutta la rete
sudo ufw allow from 192.168.1.0/24 to any port 8080 proto tcp   # solo LAN
sudo ufw allow in on tailscale0 to any port 8080 proto tcp      # solo Tailscale
```

---

## 12. Accesso via Tailscale

- Il **PC client** e il **Raspberry** devono appartenere alla **stessa tailnet**.
- Verifica lo stato e recupera l'indirizzo:

  ```bash
  tailscale status
  tailscale ip -4        # es. 100.64.0.10
  ```

- Con **MagicDNS** attivo puoi usare direttamente l'hostname:
  `http://rpi-dashboard:8080`.
- Verifica la raggiungibilità: `ping rpi-dashboard` oppure
  `curl http://rpi-dashboard:8000/api/health`.
- **Non serve un exit node**: l'accesso alla dashboard avviene sulla mesh
  Tailscale, senza instradare tutto il traffico. Tienilo disattivato.

Distinguere problema di **rete** da problema dell'**app**:

1. `tailscale status`/`ping` falliscono → problema di **rete/Tailscale**.
2. rete OK ma `curl .../api/health` fallisce → problema dell'**applicazione**
   (servizio non avviato, binding su `127.0.0.1`, porta non esposta).
3. health OK ma la UI dà errori → probabile problema **CORS** (vedi §9) o
   proxy nginx non configurato correttamente.

---

## 13. Accesso dalla rete locale (LAN)

Perché un altro dispositivo veda la dashboard:

1. il servizio ascolta su **`0.0.0.0`** (§7);
2. la **porta** è esposta (`8080` frontend, `8000` backend) (§10);
3. il **firewall** consente la connessione (§11);
4. dal browser di un altro dispositivo usa l'**IP del Raspberry**, es.
   `http://192.168.1.50:8080` — **non** `localhost`.

Trova l'IP LAN del Pi con `hostname -I`.

---

## 14. URL di esempio

```text
http://localhost:8080                              # dal Raspberry stesso
http://192.168.1.50:8080                           # LAN (IP)
http://rpi-dashboard.local:8080                    # LAN (mDNS)
http://100.64.0.10:8080                            # Tailscale (IP)
http://rpi-dashboard:8080                          # Tailscale (MagicDNS)
http://rpi-dashboard.example-tailnet.ts.net:8080   # Tailscale (FQDN)
```

(Adatta la porta a `FRONTEND_PORT`; le API rispondono sulla porta `BACKEND_PORT`.)

---

## 15. Proxy nginx (architettura attuale)

nginx è il punto di accesso unico alla dashboard, **sia in Docker sia in
modalità native**:

- **Frontend**: nginx serve i file statici React sulla porta `FRONTEND_PORT`.
- **Proxy `/api`**: nginx instrada le richieste REST al backend (stessa porta,
  nessuna porta aggiuntiva da esporre o configurare nel bundle).
- **Proxy `/api/ws/`**: WebSocket della shell web instradati con upgrade HTTP/1.1.

Grazie a questo schema il frontend usa URL relativi e funziona su qualsiasi
indirizzo senza rebuild. Per esporre la dashboard su **HTTPS** o su una **porta
standard (80/443)** puoi configurare nginx come reverse proxy con certificati
(es. `tailscale cert` per i domini `*.ts.net`, Certbot/Let's Encrypt o un
certificato autofirmato).

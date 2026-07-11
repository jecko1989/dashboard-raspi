# Test PoC — Rilevamento di un nodo Tailscale dalla dashboard (Windows 11)

Documenti correlati (stato progetto):

- `README.md` (panoramica generale)
- `docs/DEPLOYMENT.md` (rete/deploy/CORS)
- `docs/ROADMAP.md` (milestone future)
- `docs/VERSIONING.md` (regole commit/release)

Guida rapida per verificare, su un **singolo laptop Windows 11**, che la
Raspberry Dashboard rilevi un nodo tramite **Tailscale**. Il laptop fa sia da
**nodo monitorato** (Tailscale + server SSH) sia da **host della dashboard**.

---

## ⚠️ Aspettativa importante

- Il laptop verrà **rilevato come ONLINE** (lo stato usa un check **TCP** sulla
  porta SSH via Tailscale) e vedrai la **latenza**.
- Le **metriche** (CPU/RAM/disco/temperatura) resteranno **vuote** (`—`), perché
  la raccolta usa comandi Linux (`top`, `free`, `df`, `/proc`, `/sys`) che su
  Windows non esistono.
- Per metriche complete il target deve essere un **Raspberry/Linux**. Per
  verificare *“la dashboard rileva il nodo”*, Windows va benissimo.

---

## Prerequisiti

- Windows 11.
- Progetto già funzionante in locale (Python 3.12 + Node): avvio con `run-local.ps1`.
- Un account Tailscale (piano Personal gratuito).

---

## Passo 1 — Installa Tailscale su Windows 11

1. Scarica da <https://tailscale.com/download/windows> e installa.
2. Avvia Tailscale (icona nella tray) → **Log in** → accedi (Google/GitHub/email):
   si crea il tuo tailnet.
3. Prendi l'indirizzo del nodo, in PowerShell:
   ```powershell
   tailscale ip -4        # es. 100.101.102.103
   tailscale status
   ```
   > Se `tailscale` non è nel PATH:
   > `& "C:\Program Files\Tailscale\tailscale.exe" ip -4`
4. (Consigliato) Nella admin console <https://login.tailscale.com/admin> abilita
   **MagicDNS**, così puoi usare il **nome** (es. `laptop-test`) al posto dell'IP.

---

## Passo 2 — Abilita un server SSH sul laptop (la “porta” da rilevare)

In **PowerShell come amministratore**:

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
Get-NetTCPConnection -LocalPort 22 -State Listen   # deve mostrare sshd in ascolto
```

L'installazione di OpenSSH Server aggiunge già la regola firewall per la porta 22.

Verifica la raggiungibilità via Tailscale (dallo stesso laptop va bene):

```powershell
Test-NetConnection <IP-tailscale-del-laptop> -Port 22   # TcpTestSucceeded : True
```

---

## Passo 3 — Aggiungi il laptop come device di test

In [config/devices.yaml](config/devices.yaml), sotto `casa_mia` → `devices:`,
aggiungi questo blocco (indentazione a 6 spazi, come gli altri device):

```yaml
      - id: laptop-test
        name: "Laptop Test (Windows)"
        hostname: "laptop-test"
        ip_vpn: "100.101.102.103"     # <-- IP o nome Tailscale del laptop (Passo 1)
        description: "Nodo di test per verificare Tailscale"
        tags: ["test"]
        ssh:
          username: "TUO_UTENTE_WINDOWS"
          port: 22
          key_path: "${SSH_KEYS_DIR}/id_test"   # può non esistere: lo stato online usa il check TCP
        services: []
```

> La rilevazione online **non** richiede che la chiave SSH esista: usa solo il
> check TCP sulla porta 22. La chiave servirebbe solo per le metriche (che qui
> restano vuote su Windows).

---

## Passo 4 — Avvia la dashboard sullo stesso laptop

```powershell
.\run-local.ps1
```

- Apri <http://localhost:5173>
- Login: **admin / admin**
- Tailscale deve restare **attivo** (il backend gira sull'host e usa la sua rete
  Tailscale).

---

## Passo 5 — Verifica il rilevamento

1. **Overview** → apri il device *“Laptop Test (Windows)”*.
2. Premi **“Verifica ora”**.
3. Atteso:
   - badge **Online** ✅
   - **VPN raggiungibile**
   - **latenza** in ms
   - *Ultima verifica* aggiornata
   - card metriche a `—` (normale su Windows)

Se lo vedi **Online** → Tailscale + rilevamento dashboard funzionano end-to-end. 🎉

---

## Passo 6 — Pulizia dopo il test (facoltativo)

```powershell
Stop-Service sshd
Set-Service -Name sshd -StartupType Manual
```

E rimuovi il blocco `laptop-test` da `config/devices.yaml`.

---

## Troubleshooting

| Sintomo | Verifica |
|---------|----------|
| Device sempre **Offline** | `tailscale status` (nodo attivo?); `Test-NetConnection <ip> -Port 22` → `True`? `sshd` in ascolto? |
| `TcpTestSucceeded : False` | il servizio `sshd` è avviato? Firewall: consenti la porta 22 (`New-NetFirewallRule -DisplayName "SSH" -Direction Inbound -LocalPort 22 -Protocol TCP -Action Allow`) |
| Nome Tailscale non risolto | usa l'IP `100.x` al posto del nome, oppure abilita **MagicDNS** nella console |
| La dashboard non parte | vedi sezione locale del README; Tailscale attivo; login `admin/admin` |
| Metriche vuote | atteso su Windows: per metriche complete usa un target **Linux/Raspberry** |

---

## Prossimo passo (metriche reali)

Per testare anche la **raccolta metriche**, ripeti l'esperimento puntando a un
**Raspberry/Linux** con Tailscale installato (`sudo tailscale up --hostname
rpi-casa-mia`) e imposta `ip_vpn` con il suo nome/IP Tailscale. Vedi
[SETUP_CONSIGLIATO.md](SETUP_CONSIGLIATO.md).

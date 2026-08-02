# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Dashboard per monitorare e gestire più Raspberry Pi (organizzati in "luoghi", es. appartamenti) via VPN. Backend FastAPI + frontend React/TypeScript, orchestrati con Docker Compose. Stack: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, APScheduler, Paramiko (SSH) lato backend; React 18, Vite, TypeScript, Tailwind CSS, Recharts lato frontend.

**Per architettura dettagliata, modello di sicurezza, convenzioni di codice e pattern per aggiungere comandi/endpoint, vedi @AGENTS.md — è la fonte di verità e va tenuto aggiornato insieme al codice.**

## Comandi

### Backend (`cd backend`)

```bash
py -3.12 -m venv .venv && .\.venv\Scripts\Activate.ps1   # setup venv (Windows)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000                 # avvio dev

pytest                                                     # tutti i test
pytest tests/test_device_service.py                        # un file
pytest tests/test_device_service.py::test_nome_funzione    # un singolo test
pytest -k "nome_parziale"                                  # match per nome
```

### Frontend (`cd frontend`)

```bash
npm install
npm run dev              # dev server (http://localhost:5173)
npm run build             # tsc -b (type check) + vite build
npm run test               # vitest run — tutti i test
npx vitest run src/components/DeviceCreateModal.test.tsx    # un file
npx vitest run -t "nome test"                                # match per nome
```

### Ambiente locale completo (senza Docker)

```powershell
.\run-local.ps1            # setup venv, dipendenze, avvio backend + frontend (Windows)
```
```bash
./run-local.sh              # equivalente Linux/macOS
```
Login sviluppo locale: `admin / admin`.

### Docker

```bash
docker compose up --build
```
Backend su `:8000`, frontend (Nginx, proxy verso backend) su `:8080`.

## Architettura in breve

- **Config-driven**: i device sono definiti in `config/devices.yaml` (gitignored; template in `config/devices.example.yaml`).
- **Layer backend** (`backend/app/`): `api/routes/` (HTTP + validazione) → `services/` (logica applicativa) → `models/` (SQLAlchemy 2.0) / `schemas/` (Pydantic v2). Le route restano sottili.
- **Scheduler** (`scheduler/scheduler.py`, APScheduler): raccoglie metriche via SSH da ogni device a intervalli regolari (`METRICS_INTERVAL_SECONDS`).
- **Sicurezza**: nessun comando SSH arbitrario — ogni comando remoto deve essere nell'allowlist (`ssh/allowlist.py`); unica eccezione è la shell web admin-only. Dettagli completi in @AGENTS.md.
- **Frontend**: tutte le chiamate HTTP passano da `frontend/src/services/api.ts` (client tipizzato); niente fetch diretti nei componenti. Logica di fetch/stato in hook dedicati (`src/hooks/`).

## Skill Claude Code disponibili in questo repo

- `.claude/skills/aggiorna-documentazioni` — aggiorna CHANGELOG, ROADMAP, AGENTS.md e README in base ai commit non ancora documentati.
- `.claude/skills/crea-pr` — verifica lo stato del branch, invoca `aggiorna-documentazioni` e apre la PR via `gh` CLI con titolo/descrizione generati dai commit.

(Esistono anche versioni generiche delle stesse skill in `~/.claude/skills/`, usate quando si lavora fuori da questo repo, e le versioni originali in `.github/skills/` mantenute per compatibilità con altri strumenti.)

---
name: aggiungere-comando-o-endpoint
description: "Checklist passo-passo per aggiungere un nuovo comando remoto SSH (allowlist) o un endpoint operativo sensibile. Usare quando: si aggiunge un comando all'allowlist SSH; si espone un nuovo endpoint che esegue azioni operative (SSH, backup, restore, ecc.)."
---

# Aggiungere un comando remoto o un endpoint sensibile

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

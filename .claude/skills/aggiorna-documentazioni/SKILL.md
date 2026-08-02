---
name: aggiorna-documentazioni
description: "Analizza lo stato attuale del progetto e aggiorna tutta la documentazione. Usare quando: le doc sono desincronizzate dal codice; prima di creare una PR; dopo aver completato una feature o milestone; l'utente chiede di aggiornare README, CHANGELOG, ROADMAP o AGENTS.md."
argument-hint: "Sezione specifica da aggiornare (opzionale, es: changelog, roadmap, readme)"
---

# Aggiorna Documentazioni

## Quando usare
- Prima di aprire una PR (chiamata automatica dalla skill `crea-pr`)
- Dopo aver completato una feature o una milestone
- Quando si rileva che la documentazione è desincronizzata dal codice
- Su richiesta esplicita dell'utente

## Documenti gestiti

| File | Scopo |
|------|-------|
| `CHANGELOG.md` | Sezione `[Unreleased]` — aggiunge voci mancanti per le feature/fix del branch |
| `docs/ROADMAP.md` | Stato milestone e task — marca completate, aggiorna date |
| `AGENTS.md` | Pattern e convenzioni — aggiorna se emergono nuove pratiche |
| `README.md` | Overview progetto — aggiorna se cambiano funzionalità principali o setup |

## Procedura

### 1. Raccolta contesto

Eseguire i seguenti comandi per capire lo stato attuale:

```bash
# Commit non ancora in una release (rispetto al main o all'ultimo tag)
git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD")..HEAD

# File modificati rispetto al branch base
git diff --name-only $(git merge-base HEAD main 2>/dev/null || echo "HEAD~10")

# Branch corrente
git branch --show-current

# Ultimo tag di release
git describe --tags --abbrev=0 2>/dev/null || echo "(nessun tag)"
```

### 2. CHANGELOG.md — sezione `[Unreleased]`

Leggere la sezione `[Unreleased]` attuale in `CHANGELOG.md`.

Per ogni commit rilevante non ancora documentato:
- Classificare in `### Features`, `### Fix`, `### Refactor`, `### Docs`, `### Chore` in base al tipo Conventional Commit
- Usare il formato: `* **scope:** descrizione breve in italiano`
- **Non** aggiungere duplicati: verificare che la voce non esista già

Regole di scrittura:
- Frasi brevi, in italiano, stile imperativo o descrittivo (es. "aggiunge", "corregge", "rimuove")
- Scope tra `**grassetto**` (es. `**backend**`, `**frontend**`, `**deploy**`)
- Solo modifiche rilevanti per l'utente finale o per il manutentore; omettere refactor puramente interni senza impatto

### 3. ROADMAP.md

Leggere `docs/ROADMAP.md` e verificare:
- Milestone completate: segnare `[COMPLETATA]` e aggiornare la data se necessario
- Task `[ ]` che risultano completati dai commit: cambiare in `[x]`
- Aggiornare `Data ultimo aggiornamento` e `Baseline corrente` / `Prossimo target` se cambiati

### 4. AGENTS.md

Leggere `AGENTS.md` e verificare se i commit introducono:
- Nuovi pattern architetturali (es. nuovo tipo di endpoint, nuovo modello di sicurezza)
- Nuove variabili d'ambiente (aggiungerle alla tabella)
- Nuovi comandi remoti o servizi (aggiornare sezioni pertinenti)
- Modifiche alla struttura frontend (hooks, servizi, componenti notevoli)

Aggiornare solo ciò che è effettivamente cambiato; non riscrivere sezioni invariate.

### 5. README.md

Verificare se i commit modificano:
- Funzionalità principali descritte nell'introduzione
- Istruzioni di setup o configurazione
- Requisiti di sistema

Aggiornare solo se ci sono differenze sostanziali.

### 6. Conferma

Al termine, riportare un riepilogo delle modifiche apportate a ciascun file, oppure segnalare se un file era già aggiornato e non ha richiesto modifiche.

# Milestone Workflow - Guida per i Developer

## 🎯 Panoramica

Il vostro progetto usa un **flusso di versionamento basato su milestone**:
- Ogni PR viene assegnata a una **milestone GitHub** (v0.6.0, v0.7.0, etc.)
- Quando la PR mergia su `main`, il workflow automatico:
  1. Legge il footer `Milestone:` dal commit
  2. Configura Release Please per creare il tag e release con quella versione
  3. Aggiorna CHANGELOG.md e `.release-please-manifest.json`

**Vantaggi**:
- ✅ Versioning **prevedibile** e **pianificato** dalla roadmap
- ✅ Automatico: zero step manuali
- ✅ Sincronizzato con GitHub Milestones
- ✅ Fallback automático se milestone non specificato

---

## 🚀 Flusso Operativo

### Step 1: Crea il Branch

```bash
git checkout -b feat/my-feature
# Oppure: fix/my-bug, docs/my-docs, etc.
```

### Step 2: Sviluppa e Commit

Scrivi commit in **Conventional Commits**:

```bash
git commit -m "feat(ui): aggiunge menu contestuale"
# oppure
git commit -m "fix(auth): corregge scadenza JWT"
```

**Opzionale** — aggiungi footer milestone (il workflow lo leggerà):

```bash
git commit -m "feat(devices): implementa CRUD device

Nuovi endpoint PUT e DELETE per device.
Risolve #42

Milestone: v0.6.0"
```

> **💡 Tip**: Usa `git config commit.template .gitmessage.txt` per abilitare il template commit locale!

### Step 3: Apri Pull Request su GitHub

1. **Pusha il branch**:
   ```bash
   git push origin feat/my-feature
   ```

2. **Apri PR** su GitHub (o via CLI):
   ```bash
   gh pr create --base main --title "[v0.6.0] Implementa feature" --body "Descrizione..."
   ```

3. **Assegna il milestone** (dropdown PR):
   - Seleziona la milestone corrispondente (v0.6.0, v0.7.0, etc.)
   - Se non disponibile → crea da Issues → Milestones

4. **Compila la checklist** nel PR template:
   - Conferma tipo commit Conventional
   - Conferma milestone assegnato
   - Esegui test

### Step 4: Merge su main

Quando la PR è approvata:

```bash
# Merge (squash consigliato per lineare commit)
git merge feat/my-feature --squash
git push origin main
```

Oppure usa GitHub UI → "Squash and merge"

### Step 5: Automatico — Release Please Crea Release

Il workflow `release-please.yml` attiva automaticamente:

1. **Estrae il footer** dal commit:
   ```
   Milestone: v0.6.0
   ```

2. **Configura Release Please** con `target-version=v0.6.0`

3. **Crea**:
   - Tag: `v0.6.0`
   - Release su GitHub
   - Aggiorna CHANGELOG.md
   - Aggiorna `.release-please-manifest.json`

---

## 📋 GitHub Milestones Disponibili

Da creare su GitHub → **Issues → Milestones**:

| Milestone | Descrizione |
|-----------|-----------|
| **v0.6.0** | Gestione entita' da UI (CRUD, modifica, rimozione) |
| **v0.7.0** | Impostazioni e UX monitoraggio (grafici integrati) |
| **v0.8.0** | Servizi operativi unificati (Mysterium, Tailscale) |
| **v0.9.0** | Integrazione AI (assistente operativo) |

> Se una milestone **non esiste** su GitHub, il footer `Milestone:` nel commit è ancora valido — il workflow la usa come `target-version`.

---

## 🎨 Esempi Pratici

### Esempio 1: Feature per v0.6.0

```bash
# Branch e commit
git checkout -b feat/device-crud
git commit -m "feat(ui): aggiunge modifica device

Nuovo endpoint PUT /api/devices/{id}
Menu 3-puntini su DeviceCard.

Milestone: v0.6.0"

# Push e apri PR
git push origin feat/device-crud

# [Su GitHub] Assegna milestone v0.6.0 e merge

# ✅ Automaticamente crea tag v0.6.0
```

### Esempio 2: Fix senza milestone specifico

```bash
# Se ometti Milestone, il bump è automatico
git commit -m "fix(auth): corregge JWT expiry

Aumenta timeout da 15min a 1h.
Risolve #55"

git push origin main

# ✅ Release Please fa bump automatico (Conventional → PATCH)
# Risultato: v0.6.0 → v0.6.1
```

### Esempio 3: Breaking Change

```bash
git commit -m "feat(api)!: rinomina apartment in location

Cambia schema API e DB.

BREAKING CHANGE: endpoint e modelli usano location al posto di apartment
Milestone: v1.0.0"

# ✅ Release Please riconosce ! + BREAKING CHANGE
# Fa MAJOR bump e usa Milestone se specifico
# Risultato: v0.6.0 → v1.0.0
```

---

## 🛠️ Script Helper: Bump Manuale

Se vuoi fare il bump della versione **manualmente** (es. coordinare release batch):

```bash
# Lista milestone disponibili
python scripts/bump-to-milestone.py --list

# Output:
#   v0.6.0
#   v0.7.0
#   v0.8.0
# 📌 Versione attuale: v0.1.2

# Preview (dry-run)
python scripts/bump-to-milestone.py --dry-run

# Esegui bump
python scripts/bump-to-milestone.py
# Output: ✅ .release-please-manifest.json aggiornato a v0.6.0

# Commit e push (Release Please reagisce)
git add .release-please-manifest.json
git commit -m "chore(release): bump to v0.6.0"
git push
```

---

## 🔍 Verificare lo Stato

### Verificare quale milestone è attualmente configurato

```bash
cat .release-please-manifest.json
# {"." : "0.1.2"}
```

### Verificare le milestone su GitHub

```bash
# Con GitHub CLI (se installato)
gh milestone list --repo jecko1989/dashboard-raspi
```

### Vedere l'ultimo commit e il footer

```bash
git log -1 --pretty=format:"%b"
# Output: Milestone: v0.6.0
```

---

## ✅ Checklist prima di Merge

- [ ] Commit in **Conventional Commits** (`feat:`, `fix:`, `docs:`, etc.)
- [ ] **Milestone assegnato** su GitHub PR
- [ ] **Footer `Milestone: vX.Y.Z`** nel commit (opzionale ma consigliato)
- [ ] Test backend/frontend passano
- [ ] Nessun secret o token nel codice
- [ ] CHANGELOG.md aggiornato se necessario

---

## 🚨 Troubleshooting

### "GitHub Actions is not permitted to create or approve pull requests"

**Soluzione**: Vai su **Settings → Actions → General → Workflow permissions**:
- ✅ "Read and write permissions"
- ✅ "Allow GitHub Actions to create and approve pull requests"

### Release creato con versione sbagliata

**Verificare**:
1. Il footer `Milestone:` è nel commit messaggio?
   ```bash
   git log --oneline -5
   # Se vedi "Milestone: v0.6.0" nel body
   ```

2. La milestone è assegnata su GitHub?
   - Se milestone GitHub esiste ma non è assegnato alla PR, il footer nel commit ha priorità

3. Il workflow è stato eseguito correttamente?
   - Vai su **Actions** → **release-please** → ultimi run

### Script Python non funziona

```bash
# Assicurati di avere Python 3.7+
python --version

# Se errore "Modulo non trovato":
# Lo script usa solo librerie standard (re, json, pathlib)
# Non richiede dipendenze esterne

# Rendi eseguibile (Linux/macOS):
chmod +x scripts/bump-to-milestone.py
```

---

## 📚 Documenti Correlati

- [VERSIONING.md](../docs/VERSIONING.md) — Convenzione Conventional Commits e SemVer
- [ROADMAP.md](../docs/ROADMAP.md) — Milestone e priorita'
- [CHANGELOG.md](../CHANGELOG.md) — Storico release
- [.github/workflows/release-please.yml](./.github/workflows/release-please.yml) — Workflow GitHub Actions

---

## 🎓 Domande Frequenti

**D: Posso fare commit senza milestone?**  
R: Sì! Se non specifichi `Milestone:`, Release Please fa bump automatico basato su Conventional Commits. Ma per milestone milestone pianificate è meglio essere espliciti.

**D: Cosa succede se la milestone non esiste?**  
R: Il workflow la usa comunque come `target-version`. Non c'è rischio.

**D: Devo creare i milestones su GitHub?**  
R: No, è opzionale. Ma è consigliato per UX e visibility del team.

**D: Posso fare merge diretto su main senza PR?**  
R: Tecnicamente sì, ma **sconsigliato**. Le PR permettono review e danno tracciabilità al workflow.

**D: Come rollback una release?**  
R: Ripeti il bump con una versione precedente e crea un commit di hotfix, oppure crea un tag manuale con rollback nel commit.

---

**Domande?** Controlla i dettagli nel [VERSIONING.md](../docs/VERSIONING.md) oppure crea un issue! 🚀

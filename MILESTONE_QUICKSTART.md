# ⚡ Quickstart Milestone Workflow

## TL;DR — Flusso in 4 step

### 1️⃣ **Branch + Develop**
```bash
git checkout -b feat/my-feature
git commit -m "feat(area): descrizione

Milestone: v0.6.0"
```

### 2️⃣ **Push e PR**
```bash
git push origin feat/my-feature
# Apri PR su GitHub
# ✅ Assegna milestone: v0.6.0
```

### 3️⃣ **Merge**
```bash
# Merge su main (via GitHub UI o CLI)
git merge feat/my-feature --squash
git push origin main
```

### 4️⃣ **Automatico ✨**
```
GitHub Actions → release-please.yml esegue:
  ✅ Legge footer "Milestone: v0.6.0"
  ✅ Crea tag v0.6.0
  ✅ Aggiorna CHANGELOG.md
  ✅ Pubblica Release su GitHub
  ✅ Aggiorna .release-please-manifest.json
```

**Risultato**: Release pubblicata con versione corretta! 🎉

---

## 📋 Checklist PR

Prima di fare merge, verifica:

- [ ] Commit: `feat(...)`, `fix(...)`, `docs(...)`, etc.
- [ ] Footer: `Milestone: v0.6.0` (opzionale ma consigliato)
- [ ] Milestone assegnato su GitHub
- [ ] Test passano
- [ ] Nessun secret nel codice

---

## 🎯 Prossime Milestone

```
v0.1.2 (attuale) ↓
  
  → v0.6.0: Gestione entita' da UI
  → v0.7.0: Impostazioni e UX monitoraggio
  → v0.8.0: Servizi operativi unificati
  → v0.9.0: Integrazione AI
```

---

## 🛠️ Strumenti Helper

**Verifica milestone disponibili**:
```bash
python scripts/bump-to-milestone.py --list
```

**Dry-run bump**:
```bash
python scripts/bump-to-milestone.py --dry-run
```

**Bump manuale** (per coordinamento batch):
```bash
python scripts/bump-to-milestone.py
```

---

## 📖 Documentazione Completa

Leggi: [docs/MILESTONE_WORKFLOW.md](../docs/MILESTONE_WORKFLOW.md)

Per dettagli Conventional Commits: [docs/VERSIONING.md](../docs/VERSIONING.md)

---

## ✅ Setup Una Volta

Se è la prima volta, crea i milestones su GitHub:

**Settings → Issues → Milestones → New Milestone**

```
v0.6.0 - Gestione entita' da UI
v0.7.0 - Impostazioni e UX monitoraggio
v0.8.0 - Servizi operativi unificati
v0.9.0 - Integrazione AI
```

Done! ✨

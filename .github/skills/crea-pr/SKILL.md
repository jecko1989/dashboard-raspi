---
name: crea-pr
description: "Analizza il branch corrente rispetto a main, aggiorna la documentazione e apre una Pull Request con titolo e descrizione adeguati. Argomento opzionale: ID issue GitHub da chiudere (es: 42). Usare quando: l'utente vuole aprire una PR; il branch è pronto per review; si vuole automatizzare titolo/descrizione PR da commit; collegare una PR a una issue."
argument-hint: "ID issue GitHub da chiudere (opzionale, es: 42)"
---

# Crea PR

## Quando usare
- Il branch corrente ha commit pronti per review su `main`
- Si vuole generare automaticamente titolo e descrizione dalla storia dei commit
- Si vuole collegare la PR a una issue GitHub (argomento opzionale = ID issue)

## Prerequisiti
- `gh` CLI installata e autenticata (`gh auth status`)
- Branch corrente pushato su remote (`git push -u origin <branch>`)
- Permessi di scrittura sul repository

## Procedura

### 1. Verifica branch corrente e crea branch dedicato se necessario

```bash
git branch --show-current
```

**Se il branch corrente è `main` (o il branch di default):**

Prima di qualsiasi altra operazione, verificare che `main` sia aggiornato:

```bash
git fetch origin
git status -sb   # controlla se main è ahead/behind rispetto a origin/main
```

Se `main` è indietro rispetto a `origin/main`, aggiornarlo:
```bash
git pull --ff-only origin main
```

Poi creare un branch dedicato con nome descrittivo basato sulle modifiche presenti o sull'argomento (issue ID se fornito):

```bash
# Esempi di naming:
# feat/aggiunge-endpoint-cambio-password
# fix/corregge-nginx-url-relativi
# issue-42-descrizione-breve   (se argomento issue ID fornito)

git checkout -b <nome-branch>
git push -u origin <nome-branch>
```

Il nome del branch deve:
- Usare kebab-case in minuscolo
- Iniziare con il tipo Conventional Commit (`feat/`, `fix/`, `docs/`, ecc.) o con `issue-<id>-` se l'argomento è fornito
- Essere descrittivo ma conciso (max 50 caratteri)

**Se il branch corrente è già diverso da `main`**, proseguire direttamente.

### 2. Verifica stato branch

```bash
# Commit nel branch non presenti in main
git log --oneline main..HEAD

# File modificati rispetto a main
git diff --name-only main...HEAD

# Verifica che il branch sia pushato
git status -sb
```

Se il branch non è ancora pushato, eseguire:
```bash
git push -u origin $(git branch --show-current)
```

### 3. Aggiorna documentazione

Invocare la skill `aggiorna-documentazioni` prima di procedere.

Se la skill ha prodotto modifiche, effettuare un commit aggiuntivo:
```bash
git add CHANGELOG.md docs/ROADMAP.md AGENTS.md README.md
git commit -m "docs: aggiorna documentazione per PR"
git push
```

### 4. Genera titolo PR

Il titolo deve:
- Essere in italiano o seguire il Conventional Commit del commit principale
- Riassumere in modo chiaro il contenuto del branch
- Usare il formato: `<tipo>(<scope>): <descrizione breve>`

Esempi:
- `feat(backend): aggiunge endpoint cambio password`
- `fix(deploy): corregge configurazione nginx per URL relativi`
- `feat(frontend): migliora layout mobile e navigazione sidebar`

Se il branch contiene più commit eterogenei, usare il tipo predominante o `feat` generico.

### 5. Genera descrizione PR

Usare il template `.github/pull_request_template.md` come base, compilando:

- **Descrizione → Sintesi**: riepilogo in 2-4 frasi di cosa fa il branch
- **Descrizione → Motivazione**: perché questa modifica era necessaria
- **Tipo di modifica**: spuntare i tipi presenti tra i commit
- **Checklist versionamento**: verificare che i commit siano Conventional
- **Note aggiuntive → Rischi noti**: segnalare eventuali rischi identificati

Se l'argomento (issue ID) è fornito, aggiungere in fondo alla descrizione:
```
Closes #<issue_id>
```

### 6. Apri la PR con `gh`

```bash
gh pr create \
  --base main \
  --title "<titolo generato>" \
  --body "<descrizione generata>"
```

Se si vuole aprire l'editor interattivo invece:
```bash
gh pr create --base main --title "<titolo>" --body-file /tmp/pr_body.md
```

### 7. Conferma

Dopo la creazione riportare:
- URL della PR appena aperta
- Titolo utilizzato
- Se è stato aggiunto `Closes #<issue_id>` (solo se argomento fornito)
- Eventuali warning (es. branch non aggiornato rispetto a main, conflitti)

## Riferimento template PR

Consultare [.github/pull_request_template.md](../../pull_request_template.md) per il formato completo delle checklist.

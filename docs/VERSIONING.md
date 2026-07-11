# Versionamento Git e Release

Questa guida definisce la convenzione di versionamento del progetto usando:

- Conventional Commits per i messaggi di commit.
- Semantic Versioning (SemVer) per le release.
- Git tag come fonte ufficiale della versione rilasciata.

## Regole base

- Formato versione: `MAJOR.MINOR.PATCH`.
- Tag release: `vMAJOR.MINOR.PATCH` (es. `v0.7.0`).
- Branch principale: `main`.

## Stato attuale nel repository

Configurazione presente e pronta all'uso:

- Workflow GitHub Actions: `.github/workflows/release-please.yml`
- Config Release Please: `release-please-config.json`
- Manifest versioni: `.release-please-manifest.json`
- Template commit locale: `.gitmessage.txt`
- Template PR: `.github/pull_request_template.md`

Operativita': a ogni push su `main` viene valutata l'apertura/aggiornamento della
Release PR in base ai commit Conventional.

## Mapping commit -> incremento versione

- `fix:` -> PATCH (`x.y.Z`)
- `feat:` -> MINOR (`x.Y.0`)
- `feat!:` oppure footer `BREAKING CHANGE:` -> MAJOR (`X.0.0`)

Tipi consigliati aggiuntivi (non forzano bump da soli):

- `docs:` documentazione
- `test:` test
- `refactor:` refactoring senza cambi funzionali
- `chore:` manutenzione/build/tooling
- `ci:` pipeline CI/CD

## Formato commit

Pattern:

```text
type(scope): descrizione breve in italiano
```

Esempi:

```text
feat(devices): aggiunge modifica e rimozione da menu contestuale
fix(cors): include origine tailscale in CORS_ORIGINS
docs(deploy): aggiunge troubleshooting per preflight login
feat(api)!: rinomina apartment in location

BREAKING CHANGE: schema e endpoint usano location al posto di apartment
```

## Template commit locale

Il repository include un template pronto in `.gitmessage.txt`.

Per abilitarlo in locale:

```bash
git config commit.template .gitmessage.txt
```

Per verificarlo:

```bash
git config --get commit.template
```

## Naming branch

Pattern consigliato:

- `feat/<area>-<breve-descrizione>`
- `fix/<area>-<breve-descrizione>`
- `docs/<area>-<breve-descrizione>`
- `chore/<area>-<breve-descrizione>`

Esempi:

- `feat/devices-edit-delete-ui`
- `fix/auth-cors-preflight`
- `docs/roadmap-versioning`

## Flusso release

Sono supportati due flussi:

- Automatico su GitHub (consigliato): Release Please.
- Manuale (fallback): tag manuali.

### Flusso automatico (GitHub)

File usati:

- `.github/workflows/release-please.yml`
- `release-please-config.json`
- `.release-please-manifest.json`

Comportamento:

1. Ogni push su `main` avvia il workflow.
2. Release Please analizza i commit Conventional.
3. Se trova novita' rilasciabili, apre/aggiorna una Release PR.
4. Al merge della Release PR crea tag `vX.Y.Z`, GitHub Release e aggiorna `CHANGELOG.md`.

Nota: senza commit Conventional corretti il bump versione potrebbe risultare errato.

### Flusso manuale (fallback)

1. Sviluppare su branch dedicato con commit Conventional.
2. Aprire PR verso `main` e completare review/test.
3. Aggiornare `CHANGELOG.md` nella sezione `Unreleased`.
4. Determinare il bump SemVer in base ai commit inclusi.
5. Creare commit di release:

```text
chore(release): v0.7.0
```

6. Taggare la release su `main`:

```bash
git tag -a v0.7.0 -m "Release v0.7.0"
git push origin main --tags
```

7. Spostare le voci da `Unreleased` alla nuova sezione `v0.7.0 - YYYY-MM-DD` in `CHANGELOG.md`.

## Regole pratiche per questo repo

- Lingua dei commit: italiano chiaro e orientato all'azione.
- Cambi compatibili: preferire deprecazione graduale quando possibile.
- Cambi incompatibili: obbligatorio `!` o `BREAKING CHANGE:`.
- Sicurezza: per cambi su comandi/shell/auth aggiungere sempre test o nota esplicita in changelog.

## PR checklist consigliata

Prima del merge verso `main` verificare:

- [ ] Titolo PR e commit in formato Conventional Commits.
- [ ] Tipo corretto (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`).
- [ ] `CHANGELOG.md` aggiornato in `Unreleased` quando necessario.
- [ ] Eventuali cambi incompatibili marcati con `!` o `BREAKING CHANGE:`.
- [ ] Test e controlli principali eseguiti (backend/frontend) o motivazione documentata.
- [ ] Impatto sicurezza valutato per modifiche su auth, shell e comandi remoti.

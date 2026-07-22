# Changelog

## [0.9.0](https://github.com/jecko1989/dashboard-raspi/compare/v0.8.0...v0.9.0) (2026-07-22)


### Features

* **ai:** aggiunte skill Copilot Agent per workflow documentazione e PR ([#21](https://github.com/jecko1989/dashboard-raspi/issues/21)) ([16c3c6d](https://github.com/jecko1989/dashboard-raspi/commit/16c3c6d56ad532ed5c4f10bcc314984c6d9215f6))
* **backend:** add fan metrics and fan control command ([dc45696](https://github.com/jecko1989/dashboard-raspi/commit/dc456965ae97690845d6cd2be6460c7333db57d0))
* **backend:** add service start/stop commands ([1e9d222](https://github.com/jecko1989/dashboard-raspi/commit/1e9d222addcbc631db97b778d18ee47d506bbb2c))
* **backend:** aggiunge gestione servizi monitorati config-driven ([a802618](https://github.com/jecko1989/dashboard-raspi/commit/a802618c0a1b96480bc1381acca7ab984b85618c))
* **commands:** chiarisce riscatto nodo Mysterium e migliora detail UI ([65497d4](https://github.com/jecko1989/dashboard-raspi/commit/65497d4228875cb189c21294291c17c5ecf00c5d))
* **events:** add scoped events count and admin clear endpoints ([fcf5665](https://github.com/jecko1989/dashboard-raspi/commit/fcf5665f511648b6a1d8e5bbd0e24d8bcd51b121))
* **frontend:** add fan monitoring and control in device detail ([b718073](https://github.com/jecko1989/dashboard-raspi/commit/b718073f4ff7109846192d0380bcd2f77ca639de))
* **frontend:** add start/stop actions in services table ([a83e21e](https://github.com/jecko1989/dashboard-raspi/commit/a83e21ef63a0c85ea40af75907d82bbb76a5c269))
* **frontend:** implement lazy loading for routes with Suspense ([0fcbdce](https://github.com/jecko1989/dashboard-raspi/commit/0fcbdcecc3aec7eaee83a3cbea03e8b121ee29bd))
* **frontend:** rifinisce pannello servizi per UX mobile ([b8b0ec0](https://github.com/jecko1989/dashboard-raspi/commit/b8b0ec044e356218a33722c8f27873286814a1a5))
* **frontend:** update events badge, clear flow, and toast feedback ([e277a7d](https://github.com/jecko1989/dashboard-raspi/commit/e277a7d2156a27b8dd74a3908d612e882648df1d))
* **ui:** sidebar collapsibile e modali creazione coerenti ([4f6204f](https://github.com/jecko1989/dashboard-raspi/commit/4f6204fe05fb06009b40e38ab9a0670f8ac71c64))


### Bug Fixes

* add *.tsbuildinfo to .gitignore and remove tsconfig.tsbuildinfo file ([7f492cb](https://github.com/jecko1989/dashboard-raspi/commit/7f492cb25ece61a6303b3cb1184c4e6ac81e04f6))
* aggiungere istruzioni per la configurazione di CUPS con TLS e rinnovo automatico del certificato ([a02ecd2](https://github.com/jecko1989/dashboard-raspi/commit/a02ecd2c16e28e2f663d07358286bf94582b31e2))
* **ai:** skill crea-pr rileva branch main e crea branch dedicato ([#22](https://github.com/jecko1989/dashboard-raspi/issues/22)) ([dfc3d60](https://github.com/jecko1989/dashboard-raspi/commit/dfc3d60a56cd2a66688674c6d364e433b920053b))
* **backend:** remove hostname duplication checks from device creation ([1a44771](https://github.com/jecko1989/dashboard-raspi/commit/1a44771213acfe842ae9630c7fea63ad4a99cc2f))
* **deploy:** remove deprecated VITE_API_BASE_URL and update nginx configuration for relative URLs ([4ec443c](https://github.com/jecko1989/dashboard-raspi/commit/4ec443ce0097fc2d05412647283aea0da5c8d204))
* **deploy:** remove deprecated VITE_API_BASE_URL and update nginx configuration for relative URLs ([2e74e9e](https://github.com/jecko1989/dashboard-raspi/commit/2e74e9e04f6b914ebdf99ad4e7fffad8971d3b5b))
* **docs:** enhance AGENTS.md with additional details on configuration and metrics flow ([e0b7da7](https://github.com/jecko1989/dashboard-raspi/commit/e0b7da760d46230449634335e0aeca031f802208))
* **docs:** update sudoers configuration to include additional commands for deployment ([911a67c](https://github.com/jecko1989/dashboard-raspi/commit/911a67c2ecf26b9343f359cbaa5c3892b4dac39f))
* **frontend:** add missing newline at end of tsconfig.tsbuildinfo ([70bf0df](https://github.com/jecko1989/dashboard-raspi/commit/70bf0dfc4af2346bbf09c2176b4f1d29db5a721e))
* **frontend:** add z-index to user dropdown menu for proper stacking ([041d493](https://github.com/jecko1989/dashboard-raspi/commit/041d493d66215c9ed595f807d56445591c602314))
* **frontend:** aggiunge gestione delle azioni sui servizi con conferma ([facc566](https://github.com/jecko1989/dashboard-raspi/commit/facc566cdc4e5535865b38ac7082bcd6f464e8a0))
* **frontend:** conditionally render Mysterium node header based on hasMyst state ([#18](https://github.com/jecko1989/dashboard-raspi/issues/18)) ([4387bd5](https://github.com/jecko1989/dashboard-raspi/commit/4387bd5a74272a15a353a2418bd93537fadb3934))
* **frontend:** implement action menus with click-outside functionality for devices and locations ([e0af48a](https://github.com/jecko1989/dashboard-raspi/commit/e0af48ae125c782774ab4be8256bc53ce85992fd))
* **frontend:** reset luogo form state on modal reopen ([54c49e3](https://github.com/jecko1989/dashboard-raspi/commit/54c49e3fe916a28acb686ff05b5be099e1038349))
* **frontend:** sidebar fixes and animated collapse sections ([7e08c89](https://github.com/jecko1989/dashboard-raspi/commit/7e08c89a8e6acb4d691655df1448516236ec2a97))
* **frontend:** update header and sidebar to use sticky positioning for better layout ([433c931](https://github.com/jecko1989/dashboard-raspi/commit/433c931a0686d33ae8000f152753741fe42619d3))
* **frontend:** update result panels and running indicators to be context-specific in DeviceCommands ([#20](https://github.com/jecko1989/dashboard-raspi/issues/20)) ([7e99b76](https://github.com/jecko1989/dashboard-raspi/commit/7e99b76f93f187ae54b14764a7dea38f3a3db198))
* **frontend:** wrap dashboard title in NavLink for improved navigation ([fe1a1d0](https://github.com/jecko1989/dashboard-raspi/commit/fe1a1d0a218ba1562148c42f82740ca53e204bcb))
* mark final tests on real devices as completed in roadmap ([62a8390](https://github.com/jecko1989/dashboard-raspi/commit/62a8390474a35fe7043fb863e8fea75b2e36c5b0))
* migliora il layout delle etichette nel componente DeviceCommands ([5d8d1ca](https://github.com/jecko1989/dashboard-raspi/commit/5d8d1cac523a331230c06db4f2dc48f447ece26a))
* migliora le istruzioni per l'installazione della chiave SSH e aggiunge dettagli sui metodi alternativi ([d71b397](https://github.com/jecko1989/dashboard-raspi/commit/d71b39768d8760c840477b4031a8644635aa1fcd))
* **release:** attiva release milestone v0.9.0 ([8ba468b](https://github.com/jecko1989/dashboard-raspi/commit/8ba468b5217ff7b71cd441516c095192e0313b2a))
* rimuove duplicazione di variabili per l'indirizzo LAN e migliora la gestione degli URL delle impostazioni Mysterium ([6670ec8](https://github.com/jecko1989/dashboard-raspi/commit/6670ec82f2f52cc4c5e8c264a569e57db1a9a8ca))
* rimuove l'indirizzo LAN dal componente DeviceCommands per utilizzare solo l'indirizzo VPN ([2c332a4](https://github.com/jecko1989/dashboard-raspi/commit/2c332a4324be86cc6ecdbc0da6f030127c469e6c))
* timestamp visualizzati nel fuso orario corretto (Europe/Rome) ([#19](https://github.com/jecko1989/dashboard-raspi/issues/19)) ([e0a274f](https://github.com/jecko1989/dashboard-raspi/commit/e0a274f168e02d377ff432080771369ebbdb4e0d))
* **tsconfig:** add missing components to the build configuration ([73d3429](https://github.com/jecko1989/dashboard-raspi/commit/73d3429b6f29c7ca391ab5ab2c78eb79cf5f63e7))
* update .gitignore to include additional coverage and cache files ([12d0eae](https://github.com/jecko1989/dashboard-raspi/commit/12d0eae08e31aeaa005e14a469af41de3bef8b3f))
* update CUPS installation instructions to include HP components and improve security exposure details ([75fff59](https://github.com/jecko1989/dashboard-raspi/commit/75fff5994678d934250a1d9707371cd3e2bb2495))
* update setup documentation to include optional UFW section and clarify network exposure settings ([75a6fc4](https://github.com/jecko1989/dashboard-raspi/commit/75a6fc4eb52c9978a63a3be2e6df09bd7f6c4224))

## [Unreleased]

### Features

* **ai:** aggiunte skill Copilot Agent per automazione workflow (`aggiorna-documentazioni` e `crea-pr`) in `.github/skills/`; le skill orchestrano aggiornamento documentazione e apertura PR via `gh` CLI
* **backend:** aggiunge endpoint cambio password (`POST /auth/change-password`) con verifica vecchia password e hashing bcrypt; nuovo schema `ChangePasswordRequest` e servizio `change_password` in `user_service`
* **frontend:** rework layout sidebar e header — toggle tema con icone sole/luna in fondo a sinistra, menu utente a icona in alto a destra con dropdown (nome utente, cambio password, logout), animazioni smooth collapse/expand sezioni sidebar, sidebar fissa all'altezza dello schermo su desktop
* **commands:** controllo ventola CPU da UI — sezione `Ventola CPU` in `Comandi remoti` con scelta modalità (PWM automatico / FIXED) e input RPM; endpoint `POST /api/devices/{id}/commands/fan` con audit e allowlist
* **commands:** comandi Tailscale da UI — sezione `Tailscale` in `Comandi remoti` con pulsanti `Exit node`, `Subnet routes` e `Exit node + routes`; visibile solo se `tailscaled.service` è nella lista servizi monitorati
* **commands:** backup e ripristino nodo Mysterium da UI — sezione `Nodo Mysterium (myst)` in `Comandi remoti` con download .zip (stream SSH) e ripristino da file; visibile solo se `mysterium-node.service` o `myst.service` è monitorato
* **services:** gestione servizi monitorati da UI (admin-only) — aggiunta/rimozione con select suggeriti da `GET /api/devices/{id}/services/available`, conferma modale e feedback toast; persistenza su `config/devices.yaml`
* **metrics:** raccolta `fan_rpm` e `fan_mode` nelle metriche; card `Ventola CPU` nella sezione `Prestazioni` del dettaglio device
* **backend:** comandi Mysterium avvio/arresto — `POST /api/devices/{id}/commands/myst` con azione `start|stop`; avvio/arresto anche tramite service controls su `mysterium-node.service`
* **backend:** endpoint `GET /api/devices/{id}/services/available` — lista servizi systemd disponibili sull'host remoto per suggerimento in UI

### Refactor

* **frontend:** comandi remoti — i pannelli di risultato e l'indicatore "in corso" sono ora contestuali alla sezione da cui viene lanciato il comando (Aggiorna pacchetti → sotto i pulsanti principali, Ventola CPU → sotto la sua sezione, Tailscale → sotto la sezione Tailscale, Nodo myst → nella sezione myst); i comandi `tailscale` e `fan_control` passano da toast a pannello inline; solo `reboot` e `shutdown` mantengono il toast auto-dismiss
* **frontend:** aggiunto pulsante × per chiudere manualmente i pannelli risultato in `DeviceCommands`
* **frontend:** UI `Servizi` rifinita per mobile — tabella compatta con azioni a icona, stato a pallino colorato, conferme via modale e feedback toast auto-dismiss
* **frontend:** dettaglio device semplificato — box `Dettaglio` e `Prestazioni` affiancati su desktop, sezione `Servizi` nella colonna destra senza card ridondante

### Fix

* **ai:** skill `crea-pr` rileva quando ci si trova sul branch `main` e crea automaticamente un branch dedicato (con aggiornamento da `origin/main`) prima di procedere con la PR; corretta numerazione duplicata dei passi
* **deploy:** rimossa `VITE_API_BASE_URL` (deprecata); il frontend usa ora URL relativi (`/api`) e nginx fa da proxy verso il backend — lo stesso bundle funziona su qualsiasi indirizzo (LAN, Tailscale, localhost) senza rebuild
* **deploy:** aggiunta variabile `NGINX_CONF_PATH` in `deploy.env` per installazione e reload automatico del config nginx in modalità native
* **deploy:** aggiornato config nginx (Docker e native) con proxy `/api/` e `/api/ws/` verso il backend; rimosso il vecchio config senza proxy
* **frontend:** tutti i timestamp visualizzati (eventi, alert, metriche) ora mostrati nel fuso orario `Europe/Rome`; corretto bug per cui SQLite restituisce datetime senza suffisso `Z` e JavaScript li interpretava come ora locale anziché UTC, causando uno sfasamento di 2 ore in estate

---

## [0.8.0](https://github.com/jecko1989/dashboard-raspi/compare/v0.7.0...v0.8.0) (2026-07-13)


### Features

* **frontend:** complete milestone v0.8.0 events and layout redesign ([b4a2209](https://github.com/jecko1989/dashboard-raspi/commit/b4a22097010f3a03179eb5eb6734f5e2ff5f44c2))

## [0.7.0](https://github.com/jecko1989/dashboard-raspi/compare/v0.6.0...v0.7.0) (2026-07-13)


### Features

* **monitoring:** completa milestone v0.7.0 ([81f5263](https://github.com/jecko1989/dashboard-raspi/commit/81f5263bc7ed4988ac273cd2c9b5d9e6ab9c80f6))

## [0.6.0](https://github.com/jecko1989/dashboard-raspi/compare/v0.3.2...v0.6.0) (2026-07-12)


### Bug Fixes

* **ci:** use release-as for milestone version ([ef26df1](https://github.com/jecko1989/dashboard-raspi/commit/ef26df1c2d1124ddda7e094ca779fd9fe0fadc43))
* **release:** force 0.6.0 ([7182e19](https://github.com/jecko1989/dashboard-raspi/commit/7182e199000e7021c54c7c7802c9f519040027bb))

## [0.3.2](https://github.com/jecko1989/dashboard-raspi/compare/v0.3.1...v0.3.2) (2026-07-12)


### Bug Fixes

* **release:** force milestone target ([79b5993](https://github.com/jecko1989/dashboard-raspi/commit/79b5993756a9f1423a459e62ed6bc1f45c31fe8f))
* **release:** set milestone target 0.6.0 ([3476c84](https://github.com/jecko1989/dashboard-raspi/commit/3476c84dce6ceed4d6a8f10274e65368476ba349))

## [0.3.1](https://github.com/jecko1989/dashboard-raspi/compare/v0.3.0...v0.3.1) (2026-07-12)


### Bug Fixes

* **release:** trigger release-please PR ([f87bb4e](https://github.com/jecko1989/dashboard-raspi/commit/f87bb4e0fcf32c10775a43fa95092449a2e37b0c))

## [0.3.0](https://github.com/jecko1989/dashboard-raspi/compare/v0.2.1...v0.3.0) (2026-07-12)


### ⚠ BREAKING CHANGES

* **api:** endpoint e schema usano "luogo/luoghi" al posto di "apartment/apartments"; il DB viene migrato automaticamente al primo avvio. Il loader YAML accetta ancora la vecchia chiave "apartments" per compatibilità.

### Features

* **api:** rinomina apartment in luogo e aggiunge CRUD entità da UI ([10d9706](https://github.com/jecko1989/dashboard-raspi/commit/10d970618af72a3ae281a2943e315b26abfe8bca))
* **ui:** add favicon, enhance KebabMenu, and implement device creation link in Overview ([4a8088f](https://github.com/jecko1989/dashboard-raspi/commit/4a8088f972d55623a0dc5642c90e2d614a6a6e70))

## [0.2.1](https://github.com/jecko1989/dashboard-raspi/compare/v0.2.0...v0.2.1) (2026-07-12)


### Bug Fixes

* **ci:** aggiorna actions a versioni Node.js 24 native ([5eee6b5](https://github.com/jecko1989/dashboard-raspi/commit/5eee6b55ae48000c0ca3a64e4a3e32ad4a9d2ca5))

## [0.2.0](https://github.com/jecko1989/dashboard-raspi/compare/v0.1.4...v0.2.0) (2026-07-12)


### Features

* **ci:** applica approccio 1 per release selective + fixa versione action ([f942732](https://github.com/jecko1989/dashboard-raspi/commit/f942732e7de79b823f24b7499b6e56520cec94f5))


### Bug Fixes

* **ci:** calcolo manuale del bump nel workflow, ignora commit non-release ([e6acfc8](https://github.com/jecko1989/dashboard-raspi/commit/e6acfc877b216d2559d61e2651dedf1c23ba6288))
* **ci:** Release Please esegue sempre, commit-skip gestisce il bump ([2d2aa3b](https://github.com/jecko1989/dashboard-raspi/commit/2d2aa3b36c9473ce696da1bcd096ca72a9a6a4c2))
* **ci:** semplifica script bash per calcolo bump - rimuove regex complicate ([7de6e6e](https://github.com/jecko1989/dashboard-raspi/commit/7de6e6ee282ae58ff3a4a44916e61d55482bb673))
* **release:** configura Release Please per ignorare commit type non-release nel bump ([3dabce3](https://github.com/jecko1989/dashboard-raspi/commit/3dabce33ff28412c8c3af96e8e7b805e0424486f))
* **release:** rimuove bump-patch-for-minor-pre-major che causava PATCH errati ([730bfb3](https://github.com/jecko1989/dashboard-raspi/commit/730bfb3be5ecf5c4e38b4d66661986bc3dc47666))

## [0.1.4](https://github.com/jecko1989/dashboard-raspi/compare/v0.1.3...v0.1.4) (2026-07-12)


### Bug Fixes

* **ci:** release-please passa target-version solo se milestone è presente ([bd41563](https://github.com/jecko1989/dashboard-raspi/commit/bd41563b4743937718c45687de518403ce7cc76c))

## [0.1.3](https://github.com/jecko1989/dashboard-raspi/compare/v0.1.2...v0.1.3) (2026-07-12)


### Features

* **ci:** implementa milestone workflow automatico con Release Please ([5e88364](https://github.com/jecko1989/dashboard-raspi/commit/5e8836473037089d4f48ca8d4ef8cf6bc007f213))

## [0.1.2](https://github.com/jecko1989/dashboard-raspi/compare/v0.1.1...v0.1.2) (2026-07-11)


### Features

* **ui:** rendi responsive le viste principali per mobile ([98d50e2](https://github.com/jecko1989/dashboard-raspi/commit/98d50e2e1147b5f0846d22a4a1ffaf8ae884f1b8))

## [0.1.1](https://github.com/jecko1989/dashboard-raspi/compare/v0.1.0...v0.1.1) (2026-07-11)


### Features

* add allowScripts configuration for esbuild ([990c09d](https://github.com/jecko1989/dashboard-raspi/commit/990c09d219770716924126b35be8eb6c162e3c61))
* add interactive web shell for admin users ([3367852](https://github.com/jecko1989/dashboard-raspi/commit/3367852297f54939f04ceb677c87e51ae9afb50e))
* aggiunto changelog con dettagli sulle funzionalità delle fasi di sviluppo ([1bdf857](https://github.com/jecko1989/dashboard-raspi/commit/1bdf85716c15ddd353b15a069c757b0a444fa2d7))
* **devices:** implement device creation flow ([528b4f8](https://github.com/jecko1989/dashboard-raspi/commit/528b4f8e6e1d24b846fae9e3631bfeb39580b1e4))
* **scripts:** add multi-platform local run scripts with automatic dependency installation ([75a08ae](https://github.com/jecko1989/dashboard-raspi/commit/75a08ae0f8d4cb4829c2913dd7b60c764591a060))
* **ui:** add sidebar emojis and device creation entry ([4c24ce0](https://github.com/jecko1989/dashboard-raspi/commit/4c24ce0f89ae2a8a8d17a826ac8338c5636abcd6))


### Bug Fixes

* **ci:** aggiorna release-please e documenta permessi Actions ([24c7c5e](https://github.com/jecko1989/dashboard-raspi/commit/24c7c5ecea1b5d191262dece516ddbef19c3dd0c))
* **tsconfig:** add missing device create page to project root ([42a6448](https://github.com/jecko1989/dashboard-raspi/commit/42a644889aef9ed86240c6dbcbef001f8f6b6777))

## Changelog

Questo file segue una struttura compatibile con Keep a Changelog.
Le versioni usano Semantic Versioning (`MAJOR.MINOR.PATCH`) con tag Git `vX.Y.Z`.

## Unreleased

- **servizi monitorati (backend + frontend + UX mobile)**
  - Backend: nuovi endpoint admin per gestione servizi monitorati su device (`POST /api/devices/{id}/services`, `DELETE /api/devices/{id}/services/{service}`) con persistenza config-driven su `config/devices.yaml`.
  - Backend: nuovo endpoint read-only `GET /api/devices/{id}/services/available` per ottenere i servizi systemd disponibili dal device remoto.
  - Backend: validazione e test dedicati per add/remove servizi monitorati e aggiornamento allowlist read-only.
  - Frontend: pannello `Servizi` aggiornato con select servizi disponibile, conferme tramite modale per add/remove e feedback unificato via toast auto-dismiss.
  - Frontend: tabella servizi ottimizzata per mobile con azioni a icona (log/start/stop/restart/rimozione), visibilita' condizionale start/restart e stato mostrato con solo pallino.
  - Frontend: normalizzazione visuale nomi servizi (rimozione suffisso `.service` in select, modali, lista e messaggi utente).

- **ventola CPU (backend + frontend + deploy)**
  - Nuova raccolta metrica ventola: `fan_rpm` e `fan_mode` persistite nel DB ed esposte via API/CSV.
  - Sezione `Prestazioni` aggiornata: la card `Uptime` e' sostituita da `Ventola CPU` con trend RPM e stato modalita'.
  - Box dettaglio device aggiornato: `Ultima metrica` sostituito da `Uptime` testuale.
  - Nuovo comando operativo: `POST /api/devices/{id}/commands/fan` con modalita' `pwm|fixed` e conferma obbligatoria.
  - Nuova sezione `Ventola CPU` in `Comandi remoti` con selettore modalita', input RPM in fixed e conferma.
  - Nuovo helper runtime su Raspberry: `deploy/scripts/dashboard-fan-control.sh` + regole sudoers NOPASSWD dedicate.

- **eventi (backend + frontend)**
  - Nuovi filtri eventi lato API: `GET /api/events` ora supporta `device_id`, `luogo_id`, `since_hours` e `limit`.
  - Nuovo conteggio eventi per finestra temporale: `GET /api/events/count` (default ultime 24h).
  - Nuovo svuotamento eventi contestuale: `DELETE /api/events` (globale/luogo/device), consentito solo ad admin.
  - Pulsante `Eventi` ora mostra il conteggio delle ultime 24h; al click la modale puo' mostrare anche eventi piu' vecchi.
  - Aggiunto pulsante `Svuota eventi` in modale con chiusura immediata e toast di esito auto-dismiss.
  - Toast aggiornato: stile neutro coerente con tema light/dark e barra temporale che si svuota verso destra; colore barra verde/rosso in base all'esito.

- **v0.8.0 - Re design grafico (completata)**
  - Eventi resi contestuali per scope (overview, luogo, device) con nuovo pulsante campanella e contatore in testata pagina.
  - Timeline eventi aperta in modale dedicata con chiusura da pulsante e click su backdrop esterno.
  - Pagina luogo aggiornata con azione rapida `Aggiungi device` in header e pre-selezione del luogo nel form creazione device.
  - Dettaglio device riallineato: sezione `Servizi` separata da `Comandi remoti` e resa senza card dedicata.
  - Sidebar aggiornata: voce `Impostazioni` sotto `Alert`, sezioni `Luoghi` e `Azioni` collassabili (default aperte) e azioni `Aggiungi luogo`/`Aggiungi device` via modale.

- **v0.7.0 - Impostazioni e UX monitoraggio**
  - Nuovo endpoint `PUT /api/settings/thresholds` riservato agli admin, con validazione Pydantic e persistenza delle soglie globali in `config/devices.yaml`.
  - Pagina `Settings` aggiornata: modalità admin editabile con salvataggio immediato, fallback read-only per utenti non admin.
  - Pagina dettaglio device rifinita: sezione `Prestazioni` al posto di `Metriche attuali`, con trend recente dietro ai valori delle card.
  - Rimossa la sezione `Storico dettagliato`; il pulsante `Esporta CSV` è stato spostato dentro il box `Prestazioni`.
  - Tooltip dei mini-grafici compatti reso meno invasivo e compatibile con hover sulle card.

- **UX mobile**: viste principali rese responsive (mobile-first). Navigazione con drawer + hamburger su schermi piccoli (`Layout`, `Sidebar`), griglia metriche adattiva (`grid-cols-2 sm:grid-cols-3`), grafici ad altezza dinamica (`MetricChart`), tabelle con scroll anti-overflow (`ServiceStatusTable`), header e pagine core (`Overview`, `DeviceDetailPage`, `AlertsPage`, `Settings`) fluidi su viewport 360-430 px.
- Documentazione di progetto allineata con stato corrente (roadmap, versioning, deploy).
- Aggiunta roadmap milestone-based in `docs/ROADMAP.md`.
- Aggiunta guida `docs/VERSIONING.md` con Conventional Commits + SemVer.
- Configurata automazione release/versioning con Release Please:
  - `.github/workflows/release-please.yml`
  - `release-please-config.json`
  - `.release-please-manifest.json`
- Aggiunti template di collaborazione Git:
  - `.gitmessage.txt` (commit template)
  - `.github/pull_request_template.md` (PR checklist)
- Aggiornata guida deploy con troubleshooting CORS in login/preflight.

---

## Extra — Script locali multi-piattaforma

- **`run-local.sh`** (Linux/macOS): equivalente bash di `run-local.ps1`. Avvia backend e frontend in background nella stessa sessione terminale; Ctrl+C li ferma entrambi. Supporta `--skip-install`, `--backend-port`, `--frontend-port`, `--install-python` (apt/dnf/brew) e `--install-node` (nvm).
- **`run-local.ps1 -InstallNode`**: installa Node.js LTS tramite `winget install OpenJS.NodeJS.LTS` e aggiorna il PATH nella sessione corrente. In precedenza Node mancante causava un errore diretto senza possibilità di auto-installazione.

---

## Extra — Gestione device e deploy automatico

- **Aggiunta device dalla dashboard**: voce di sidebar "➕ Aggiungi device" e form dedicato (`/devices/new`). `POST /api/devices` valida i dati, gestisce hostname/IP duplicati (409) e appartamento inesistente (404), persiste il device in `config/devices.yaml` (fonte di verità) e sincronizza il DB. I campi runtime (online, latenza, ultima verifica) restano gestiti dal monitoraggio.
- **Emoji nella sidebar** (Overview, Alert, appartamenti, Impostazioni): decorative e accessibili (`aria-hidden`).
- **Deploy su Raspberry**: script generici `scripts/deploy.sh` (Docker e nativo systemd) via Tailscale o LAN, con `--dry-run`, health check e rollback (modalità nativa). Config di esempio in `deploy/deploy.env.example`, template systemd in `deploy/systemd/`.
- **Guida deploy/accesso**: `docs/DEPLOYMENT.md` (binding `0.0.0.0`, nginx proxy, CORS, firewall, LAN, Tailscale/MagicDNS).
- Porte del compose parametrizzabili (`FRONTEND_PORT`/`BACKEND_PORT`, default invariati).

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
- `GET /api/alerts` (filtro `active_only`), `GET /api/settings/thresholds`, `PUT /api/settings/thresholds`
- **Pagina Impostazioni** con lettura e, per admin, modifica delle soglie correnti.

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

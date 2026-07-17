# Roadmap - Prossimi miglioramenti

Stato: attiva (pianificazione)
Data ultimo aggiornamento: 2026-07-17
Baseline corrente: release v0.8.0 (eventi contestuali + redesign)
Prossimo target: milestone v0.9.0 (servizi operativi unificati)

## Priorita' immediata - UX mobile dashboard [COMPLETATA]

Stato: completata (2026-07-12). Le viste principali sono state rese responsive
e la navigazione mobile usa un drawer con hamburger. Build frontend verde.

### Problema rilevato
- La dashboard risulta poco usabile su smartphone (test reale su Pixel 8).

### Intervento pianificato
- Rendere completamente responsive le viste principali (overview, card device, dettaglio, tabelle, modali).
- Migliorare spaziature, tipografia e gerarchia visiva per viewport mobile.
- Ridurre overflow orizzontali e componenti compressi/non leggibili.

### Criteri di accettazione
- Navigazione completa da mobile senza zoom manuale.
- Nessun overflow orizzontale nelle pagine principali.
- Card, grafici, tabelle e modali leggibili su larghezze tipiche smartphone (es. 360-430 px).
- Performance e leggibilita' mantenute su Pixel 8.

### Piano tecnico (task operativi)

1. [x] Audit responsive delle pagine principali (`Overview`, `DeviceDetailPage`, `ApartmentPage`, `AlertsPage`, `Settings`).
2. [x] Refactor layout generale (`Layout`, `Sidebar`) con navigazione mobile-first (drawer + hamburger) e gestione corretta degli spazi.
3. [x] Refactor delle card (`ApartmentSection`, `DeviceCard`, `MetricCard`) con breakpoint coerenti e gerarchia tipografica leggibile.
4. [x] Ottimizzazione del dettaglio device (`DeviceDetails`, `DeviceCommands`) per viewport stretta e azioni touch-friendly.
5. [x] Gestione grafici responsive (`MetricChart`) con altezze dinamiche e fallback leggibile su schermi piccoli.
6. [x] Gestione tabelle e timeline (`ServiceStatusTable`, `EventTimeline`) con strategie anti-overflow (scroll controllato).
7. [x] Revisione modali (`CommandModal`, `ShellModal`) per uso mobile (fullscreen/sheet, padding adattivo).
8. [x] Test finale su dispositivi reali e viewport target (Pixel 8 + range 360-430 px) con correzione regressioni.

### Definition of Done (mobile)

- Nessun contenuto tagliato o fuori viewport nelle pagine core.
- Interazioni principali utilizzabili con una mano (tap target adeguati).
- Layout stabile in portrait e landscape sui device target.

## Obiettivo
Pianificare i prossimi miglioramenti per release incrementali, con priorita' e dipendenze chiare.

## Milestone v0.6.0 - Gestione entita' da UI [COMPLETATA]

Stato: completata (2026-07-12). Naming funzionale scelto: **Luogo** (plurale
"luoghi"), rename completo su DB, config YAML, API e UI con migrazione additiva.

### Ambito
- [x] Definire il naming funzionale al posto di "appartamento" -> scelto **Luogo**.
- [x] Creazione nuova entita' (Luogo) da interfaccia (sidebar + overview, modale dedicata).
- [x] Modifica/rimozione device da card (menu a 3 puntini) e da pagina dettaglio.
- [x] Modifica/rimozione entita' (Luogo) tramite menu a 3 puntini nella sezione.

### Criteri di accettazione
- [x] Le CRUD UI sono disponibili agli utenti autenticati.
- [x] Le operazioni distruttive richiedono conferma esplicita (modale dedicata).
- [x] Le modifiche sono riflesse in backend, config e UI senza refresh manuale
  (evento `devices:changed`).

### Note di implementazione
- Backend: nuovi endpoint `POST/PUT/DELETE /api/luoghi` e `PUT/DELETE /api/devices/{id}`.
  L'eliminazione di un luogo e' consentita solo se non contiene device (409 altrimenti).
- Config `devices.yaml` resta la fonte di verita': ogni CRUD muta lo YAML e
  risincronizza il DB. Il loader accetta ancora la vecchia chiave `apartments`.
- Migrazione DB additiva: rename tabella `apartments`->`luoghi`, colonna
  `devices.apartment_id`->`luogo_id` e nuova colonna `devices.tags` (JSON).


## Milestone v0.7.0 - Impostazioni e UX monitoraggio [COMPLETATA]

Stato: completata (2026-07-13). Le soglie globali alert sono ora modificabili da
UI per gli admin con persistenza su `devices.yaml`; i grafici sono stati
integrati direttamente nei blocchi di "Metriche attuali" mantenendo anche una
vista storica dettagliata.

### Ambito
- [x] Modifica dei valori dal menu impostazioni se utente admin.
- [x] Integrazione dei grafici dentro i blocchi di "Metriche attuali".

### Criteri di accettazione
- [x] Le impostazioni admin sono persistite e validate lato backend.
- [x] I grafici sono leggibili su desktop e mobile senza regressioni UX.

### Note di implementazione
- Backend: nuovo endpoint `PUT /api/settings/thresholds` riservato agli admin,
  con validazione Pydantic e persistenza config-driven su `config/devices.yaml`.
- Frontend: pagina `Settings` con modalità admin editabile e fallback read-only
  per utenti non admin.
- UX monitoraggio: ogni `MetricCard` mostra valore corrente e trend recente;
  lo storico completo resta disponibile come vista dettagliata con export CSV.

## Milestone v0.8.0 - Re design grafico [COMPLETATA]

Stato: completata (2026-07-14). La UX e' stata riallineata con gerarchia eventi
contestuale (overview/luogo/device), accesso tramite pulsante campanella con
modale, layout del dettaglio device rifinito e sezione servizi integrata senza
card ridondante.

### Ambito
- [x] Spostamento della sezione notifiche/eventi in alto a destra (gerarchia logica: overview -> tutti device, luogo -> device del luogo, device -> eventi device).
- [x] Sostituzione della campanella (come silenzia alert) per accedere agli eventi con UI coerente.
- [x] Spostamento sezione servizi (dettaglio device) a destra dove erano elencati gli eventi.
- [x] Aggiunta pulsante "nuovo device" in alto a destra nella pagina dei luoghi.
- [x] Rimozione delle voci ridondanti dal menu laterale per il flusso "nuovo device".

### Criteri di accettazione
- [x] La sezione eventi e' accessibile da overview, dettaglio luogo e dettaglio device con logica gerarchica corretta.
- [x] Il pulsante "nuovo device" nella pagina luoghi e' coerente con quello dell'overview.
- [x] Menu laterale alleggerito dalle azioni ridondanti legate al flusso nuovo device.
- [x] Layout desktop e mobile mantengono leggibilita' e usabilita'.

### Note di implementazione
- Frontend: introdotti `EventsPanel` e hook `useScopedEvents` con scope gerarchico (all/luogo/device).
- Eventi: resa come pulsante campanella in header pagina con contatore; apertura timeline in modale e chiusura anche con click fuori dalla modale.
- Refactor pagine (`Overview`, `LuogoPage`, `DeviceDetailPage`) per la nuova gerarchia eventi e l'azione contestuale "nuovo device" su luogo.
- Sidebar: rimossa la voce ridondante "Aggiungi device".
- Device detail: sezione servizi separata nella colonna destra, senza box/card dedicata, con sfondo coerente alla sezione comandi.

## Milestone v0.9.0 - Servizi operativi unificati [IN CORSO]

### Ambito
- [x] Aggiunta servizi da UI.
- [ ] Integrazione comandi Mysterium Node (avvio, stop, backup, restore) nel menu servizi.
- [ ] Integrazione comandi Tailscale nel menu servizi con lo stesso pattern.
- [x] Controllo ventola CPU da UI (PWM/FIXED + RPM) con endpoint protetto e audit.

### Criteri di accettazione
- Tutte le azioni passano da endpoint protetti e auditati.
- Le azioni sensibili mantengono vincolo admin e conferma obbligatoria.

### Note di implementazione (stato attuale)
- Endpoint ventola: `POST /api/devices/{id}/commands/fan` con `mode` (`pwm|fixed`) e `rpm` opzionale in fixed.
- Raccolta metriche estesa con `fan_rpm` e `fan_mode`; UI `Prestazioni` aggiornata con card `Ventola CPU`.
- Per il runtime e' richiesto helper sul Raspberry: `/usr/local/sbin/dashboard-fan-control` con regole sudoers NOPASSWD dedicate.
- Nuovi endpoint servizi monitorati: `POST /api/devices/{id}/services` (add) e `DELETE /api/devices/{id}/services/{service}` (remove), admin-only con `confirm=true`, persistenza su `config/devices.yaml` e sync DB.
- Nuovo endpoint read-only `GET /api/devices/{id}/services/available` per suggerire servizi systemd nella select UI.
- UI `Servizi` rifinita per mobile: tabella compatta con azioni a icona, stato a pallino, conferme via modale e feedback toast auto-dismiss.
- Stato corrente UX: il pannello `Servizi` e' focalizzato su monitoraggio e gestione lista servizi; i comandi operativi avanzati restano in `Comandi remoti`.

## Milestone v0.9.5 - Wiki e documentazione UI

### Ambito
- Creazione Wiki completa per l'utilizzo della dashboard con documentazione visuale.
- Screenshot e spiegazioni di tutte le sezioni principali (overview, dettaglio luogo, dettaglio device, impostazioni, shell web).
- Guide step-by-step per le operazioni comuni (aggiungere device, gestire comandi, monitorare metriche).
- FAQ e troubleshooting per utenti finali.

### Criteri di accettazione
- Ogni sezione della UI è documentata con almeno uno screenshot e descrizione.
- Le guide step-by-step sono chiare e facili da seguire anche per utenti non tecnici.
- La Wiki è accessibile da link in-app (footer o menu help).
- Linguaggio consistente con la UI (italiano).

### Note di implementazione
- Creazione cartella `docs/wiki` con file markdown organizzati per sezione.
- Screenshots catturati su viewport standard (desktop 1920x1080 e mobile 375x667).
- Link nella UI che rimandano alla Wiki (footer o icona help contextuale).
- Possibile integrazione futura con search interno per ricerca nella documentazione.

## Milestone v1.0.0 - Guida interattiva per il primo utilizzo

### Ambito
- Implementazione di un onboarding interattivo per nuovi utenti al primo login.
- Tour guidato delle sezioni principali (overview, luogo, device, impostazioni).
- Tooltip contextual e evidenziazione degli elementi UI chiave durante la guida.
- Possibilità di saltare o ripetere la guida da impostazioni utente.
- Integrazione con la Wiki per rinvii approfonditi.
- Tasto help floating in basso a destra per aiuto interattivo contestuale.
- Aiuto dinamico basato sulla sezione corrente (overview, luoghi, device, aggiunta luoghi, aggiunta device, etc).

### Criteri di accettazione
- La guida interattiva appare automaticamente al primo login dell'utente.
- Ogni step evidenzia chiaramente l'elemento da interagire con tooltip descrittivo.
- L'utente può navigare tra gli step (next, previous, skip all).
- La guida è completabile in 3-5 minuti senza bloccare l'accesso alle funzionalità.
- Stato della guida è persistito in user preferences (non ripete se completata).
- Il tasto help floating è sempre disponibile e non intralcia la navigazione.
- Su mobile, il tasto help floating è posizionato in modo da non coprire elementi interattivi (es. FAB per azioni principali).
- Il contenuto help contestuale è rilevante alla pagina corrente.

### Note di implementazione
- Frontend: nuovo componente `OnboardingGuide` con logica di step sequenziali e overlay.
- Tour builder: hook `useOnboarding` per gestire stato, highlights e tooltip.
- Storage: flag `onboarding_completed` nel profilo utente o localStorage con UUID utente.
- Highlights: uso di libreria leggera (es. Shepherd.js o custom overlay) per evidenziare elementi.
- Accessibilità: keyboard navigation, focus trap e ARIA labels per screen reader.
- Analytics: tracking degli step completati per misurare engagement.
- Tasto help floating: componente `FloatingHelpButton` con detection della route corrente e mapping a contenuti help specifici.
- Help engine: hook `useContextualHelp` che espone title, description, link alla Wiki basato su route/context.
- Responsive: su mobile (< 768px), il tasto help è visualizzato con icona ridotta e positioning adeguato per evitare conflitti con altre FAB o azioni bottom.
- Help content: file markdown in `docs/wiki/help-topics/` con sezioni per ogni pagina (overview.md, luoghi.md, device.md, etc).

## Backlog trasversale

- Uniformare i menu contestuali (3 puntini) tra tutte le card.
- Consolidare naming dominio su backend, frontend e documentazione.
- Aggiornare test backend/frontend a ogni milestone.

## Riferimento versionamento

Per la convenzione di versionamento Git e release, vedere `docs/VERSIONING.md`.

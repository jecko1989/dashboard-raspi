# Roadmap - Prossimi miglioramenti

Stato: attiva (pianificazione)
Data ultimo aggiornamento: 2026-07-12
Baseline corrente: release v0.1.0 (monitoraggio + comandi + deploy + shell web)
Prossimo target: milestone v0.7.0 (milestone v0.6.0 completata)

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
8. [ ] Test finale su dispositivi reali e viewport target (Pixel 8 + range 360-430 px) con correzione regressioni.

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

## Milestone v0.8.0 - Servizi operativi unificati

### Ambito
- Aggiunta servizi da UI.
- Integrazione comandi Mysterium Node (avvio, stop, backup, restore) nel menu servizi.
- Integrazione comandi Tailscale nel menu servizi con lo stesso pattern.

### Criteri di accettazione
- Tutte le azioni passano da endpoint protetti e auditati.
- Le azioni sensibili mantengono vincolo admin e conferma obbligatoria.

## Milestone v0.9.0 - Integrazione AI

### Ambito
- Integrazione AI nell'app (assistente operativo e/o insight su metriche/eventi).

### Criteri di accettazione
- Funzioni AI attivabili/disattivabili da configurazione.
- Tracciamento minimo delle azioni AI con log/eventi.
- Nessuna riduzione delle garanzie di sicurezza esistenti.

## Backlog trasversale

- Uniformare i menu contestuali (3 puntini) tra tutte le card.
- Consolidare naming dominio su backend, frontend e documentazione.
- Aggiornare test backend/frontend a ogni milestone.

## Riferimento versionamento

Per la convenzione di versionamento Git e release, vedere `docs/VERSIONING.md`.

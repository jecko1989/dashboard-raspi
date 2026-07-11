# Roadmap - Prossimi miglioramenti

Stato: attiva (pianificazione)
Data ultimo aggiornamento: 2026-07-11
Baseline corrente: release v0.1.0 (monitoraggio + comandi + deploy + shell web)
Prossimo target: milestone v0.6.0

## Obiettivo
Pianificare i prossimi miglioramenti per release incrementali, con priorita' e dipendenze chiare.

## Milestone v0.6.0 - Gestione entita' da UI

### Ambito
- Definire il naming funzionale al posto di "appartamento" (candidati: luogo, ambiente).
- Creazione nuova entita' (ex appartamento) da interfaccia.
- Modifica/rimozione device da card (menu a 3 puntini).
- Modifica/rimozione entita' (menu a 3 puntini).

### Criteri di accettazione
- Le CRUD UI sono disponibili solo per utenti autorizzati.
- Le operazioni distruttive richiedono conferma esplicita.
- Le modifiche sono riflesse in backend, config e UI senza refresh manuale.

## Milestone v0.7.0 - Impostazioni e UX monitoraggio

### Ambito
- Modifica dei valori dal menu impostazioni se utente admin.
- Integrazione dei grafici dentro i blocchi di "Metriche attuali".

### Criteri di accettazione
- Le impostazioni admin sono persistite e validate lato backend.
- I grafici sono leggibili su desktop e mobile senza regressioni UX.

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

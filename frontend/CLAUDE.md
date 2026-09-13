# Convenzioni frontend

- **Frontend API**: tutte le chiamate HTTP passano da `frontend/src/services/api.ts`.
- **Frontend auth**: interceptor aggiunge Bearer token da localStorage; su 401 emette evento `auth:logout`. Il ruolo admin è esposto da `AuthContext` come `isAdmin` (da `getMe()`), usato per mostrare le azioni riservate (es. shell web).
- **Frontend WebSocket**: la shell usa WebSocket nativo con token in query string; l'URL si costruisce con `frontend/src/services/shell.ts` (deriva `ws`/`wss` dall'host corrente della pagina, override con `VITE_API_WS_URL`).
- **No fetch diretto**: aggiungere funzioni tipizzate in `services/api.ts` e tipi in `src/types`.
- **URL relativi**: il frontend usa sempre `/api/...` senza prefisso di host; non usare `VITE_API_BASE_URL` (deprecata e rimossa). Usare `VITE_API_WS_URL` solo per override WebSocket.
- **Hooks**: logica di fetch/stato incapsulata in hook dedicati (`useDevices`, `useLuoghi`, `useScopedEvents`, `useNavBadges`); evitare chiamate API dirette nei componenti.
- **Utils**: formattazione valori in `frontend/src/utils/format.ts`; non duplicare la logica nei componenti.

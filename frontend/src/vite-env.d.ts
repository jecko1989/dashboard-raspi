/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override URL WebSocket per la shell. Se assente, derivato da window.location. */
  readonly VITE_API_WS_URL?: string;
  /** Deprecato: non più usato per le chiamate HTTP/WS. Rimane solo come target del proxy Vite in dev. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

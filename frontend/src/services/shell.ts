// Helper per la shell web: costruzione dell'URL WebSocket autenticato.
// L'autenticazione avviene via query param `token` (i WebSocket browser non
// inviano l'header Authorization).
import { TOKEN_KEY } from './api';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Deriva l'origin WebSocket dal base URL HTTP (http->ws, https->wss).
function wsOrigin(): string {
  const explicit = import.meta.env.VITE_API_WS_URL as string | undefined;
  if (explicit) return explicit.replace(/\/$/, '');
  return baseURL.replace(/^http/i, 'ws').replace(/\/$/, '');
}

export interface ShellSocketOptions {
  cols?: number;
  rows?: number;
}

// Ritorna l'URL WebSocket della shell per un device, con token e dimensioni.
export function buildShellSocketUrl(
  deviceId: string,
  opts: ShellSocketOptions = {},
): string {
  const token = localStorage.getItem(TOKEN_KEY) ?? '';
  const params = new URLSearchParams({ token });
  if (opts.cols) params.set('cols', String(opts.cols));
  if (opts.rows) params.set('rows', String(opts.rows));
  return `${wsOrigin()}/api/ws/devices/${encodeURIComponent(deviceId)}/shell?${params.toString()}`;
}

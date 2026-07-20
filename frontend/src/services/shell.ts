// Helper per la shell web: costruzione dell'URL WebSocket autenticato.
// L'autenticazione avviene via query param `token` (i WebSocket browser non
// inviano l'header Authorization).
import { TOKEN_KEY } from './api';

// Deriva l'URL WebSocket dall'host corrente della pagina (LAN, Tailscale, localhost).
// In questo modo il WebSocket funziona su qualsiasi indirizzo senza configurazione.
function wsOrigin(): string {
  const explicit = import.meta.env.VITE_API_WS_URL as string | undefined;
  if (explicit) return explicit.replace(/\/$/, '');
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
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

// Utility di formattazione per la UI.

export function formatPercent(value: number | null | undefined): string {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

export function formatTemp(value: number | null | undefined): string {
  return value == null ? '—' : `${value.toFixed(1)} °C`;
}

export function formatLoad(value: number | null | undefined): string {
  return value == null ? '—' : value.toFixed(2);
}

export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}g ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDurationShort(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '0s';

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (d > 0) return `${d}g ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatFanMode(mode: string | null | undefined): string | null {
  if (!mode) return null;
  if (mode === 'auto') return 'PWM';
  if (mode === 'fixed') return 'Fixed';
  if (mode === 'off') return 'Disattivata';
  return null;
}

export function formatFanRpm(
  rpm: number | null | undefined,
): string {
  if (rpm == null) return 'N/A';
  return `${Math.round(rpm)} rpm`;
}

export function formatLatency(ms: number | null | undefined): string {
  return ms == null ? '—' : `${ms.toFixed(0)} ms`;
}

/** Normalizza una stringa ISO dal backend (UTC naive, senza Z) aggiungendo 'Z'. */
function toUtcIso(iso: string): string {
  return /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(toUtcIso(iso));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
}

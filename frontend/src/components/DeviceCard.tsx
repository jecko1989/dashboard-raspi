import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Device, Metric } from '../types';
import { StatusBadge } from './StatusBadge';
import { KebabMenu } from './KebabMenu';
import { formatDateTime, formatLatency, formatPercent, formatTemp, formatUptime } from '../utils/format';
import { commandReboot, commandShutdown, commandUpdate, getLatestMetric } from '../services/api';

// Card che rappresenta un singolo Raspberry.
interface DeviceCardProps {
  device: Device;
  // Azioni opzionali (menu a 3 puntini): modifica ed eliminazione.
  onEdit?: (device: Device) => void;
  onDelete?: (device: Device) => void;
}

type QuickCmd = 'update' | 'reboot' | 'shutdown';

type CmdState =
  | { phase: 'idle' }
  | { phase: 'confirm'; cmd: QuickCmd }
  | { phase: 'running'; cmd: QuickCmd }
  | { phase: 'done'; ok: boolean; msg: string };

const CMD_LABELS: Record<QuickCmd, string> = {
  update: 'aggiornamento',
  reboot: 'riavvio',
  shutdown: 'spegnimento',
};

const DONE_LABELS: Record<QuickCmd, string> = {
  update: 'Aggiornamento avviato',
  reboot: 'Riavvio avviato',
  shutdown: 'Spegnimento avviato',
};

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}

function metricColor(pct: number | null | undefined): string {
  if (pct == null) return 'text-gray-400 dark:text-gray-500';
  if (pct >= 90) return 'text-red-500 dark:text-red-400';
  if (pct >= 70) return 'text-yellow-500 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

function tempColor(celsius: number | null | undefined): string {
  if (celsius == null) return 'text-gray-400 dark:text-gray-500';
  if (celsius >= 80) return 'text-red-500 dark:text-red-400';
  if (celsius >= 65) return 'text-yellow-500 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

function MetricCell({
  label,
  value,
  pct,
  colorClass,
}: {
  label: string;
  value: string;
  pct?: number | null;
  colorClass?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${colorClass ?? metricColor(pct)}`}>{value}</span>
    </div>
  );
}

export function DeviceCard({ device, onEdit, onDelete }: DeviceCardProps) {
  const hasMenu = Boolean(onEdit || onDelete);
  const [cmdState, setCmdState] = useState<CmdState>({ phase: 'idle' });
  const [metric, setMetric] = useState<Metric | null>(null);

  useEffect(() => {
    if (!device.last_metric_at) return;
    getLatestMetric(device.id)
      .then(setMetric)
      .catch(() => setMetric(null));
  }, [device.id, device.last_metric_at]);

  const runCmd = async (cmd: QuickCmd) => {
    setCmdState({ phase: 'running', cmd });
    try {
      if (cmd === 'reboot') await commandReboot(device.id);
      else if (cmd === 'shutdown') await commandShutdown(device.id);
      else await commandUpdate(device.id, false);
      setCmdState({ phase: 'done', ok: true, msg: DONE_LABELS[cmd] });
    } catch {
      setCmdState({ phase: 'done', ok: false, msg: 'Comando fallito' });
    }
    setTimeout(() => setCmdState({ phase: 'idle' }), 2500);
  };

  const handleBtn = (cmd: QuickCmd) => {
    if (cmdState.phase === 'confirm' && cmdState.cmd === cmd) {
      void runCmd(cmd);
    } else {
      setCmdState({ phase: 'confirm', cmd });
    }
  };

  const confirmCmd = cmdState.phase === 'confirm' ? cmdState.cmd : null;

  const btnBase =
    'rounded px-2 py-1 text-xs font-medium transition disabled:opacity-40';
  const btnGhost =
    `${btnBase} text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200`;

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800">

      {/* ── Riga header: nome + badge + kebab ── */}
      <Link to={`/devices/${device.id}`} className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <div className="min-w-0 pr-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{device.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {device.hostname} · {device.ip_vpn}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge online={device.is_online} />
          {hasMenu && (
            <KebabMenu
              ariaLabel="Azioni device"
              items={[
                ...(onEdit
                  ? [{ label: 'Modifica device', icon: '✏️', onSelect: () => onEdit(device) }]
                  : []),
                ...(onDelete
                  ? [{ label: 'Elimina device', icon: '🗑️', destructive: true, onSelect: () => onDelete(device) }]
                  : []),
              ]}
            />
          )}
        </div>
      </Link>

      {/* ── Corpo: info sinistra + divider + metriche destra (50/50) ── */}
      <Link to={`/devices/${device.id}`} className="flex flex-1">
        {/* Sinistra */}
        <div className="flex flex-1 flex-col px-4 py-3">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 ${
                  device.is_online
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                VPN {device.is_online ? 'raggiungibile' : 'non raggiungibile'}
              </span>
              <span className="text-gray-400">{formatLatency(device.last_latency_ms)}</span>
              {device.alerts_muted && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  🔕 muted
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Ultima verifica: {formatDateTime(device.last_checked_at)}
            </p>
          </div>
          {device.tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {device.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Divider + Destra metriche — sempre visibile su sm+ (placeholder se assenti) */}
        <div className="hidden w-px shrink-0 self-stretch bg-gray-100 dark:bg-gray-700 sm:block" />
        <div className="hidden flex-1 flex-col justify-between px-4 py-3 sm:flex">
          {/* Griglia 2 colonne: CPU/RAM e Disco/Temp */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <MetricCell label="CPU"   value={metric ? formatPercent(metric.cpu_percent)  : '–'} pct={metric?.cpu_percent} />
            <MetricCell label="RAM"   value={metric ? formatPercent(metric.ram_percent)  : '–'} pct={metric?.ram_percent} />
            <MetricCell label="Disco" value={metric ? formatPercent(metric.disk_percent) : '–'} pct={metric?.disk_percent} />
            <MetricCell label="Temp"  value={metric ? formatTemp(metric.temperature_celsius) : '–'} colorClass={tempColor(metric?.temperature_celsius)} />
          </div>
          {/* Uptime centrato */}
          <div className="text-center text-xs">
            {metric?.uptime_seconds != null ? (
              <>
                <span className="text-gray-400 dark:text-gray-500">Uptime </span>
                <span className={`font-medium tabular-nums ${metricColor(null)}`}>
                  {formatUptime(metric.uptime_seconds)}
                </span>
              </>
            ) : (
              <span className="text-gray-400 dark:text-gray-500">–</span>
            )}
          </div>
        </div>
      </Link>

      {/* ── Barra azioni rapide ── */}
      <div className="flex items-center justify-center gap-1.5 border-t border-gray-100 px-3 py-2 dark:border-gray-700">
        {cmdState.phase === 'running' ? (
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Spinner />
            {CMD_LABELS[cmdState.cmd]}…
          </span>
        ) : cmdState.phase === 'done' ? (
          <span className={`text-xs font-medium ${cmdState.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {cmdState.msg}
          </span>
        ) : confirmCmd ? (
          <>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Confermare {CMD_LABELS[confirmCmd]}?
            </span>
            <button
              onClick={() => void runCmd(confirmCmd)}
              className={`${btnBase} bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50`}
            >
              ✓ Sì
            </button>
            <button
              onClick={() => setCmdState({ phase: 'idle' })}
              className={`${btnBase} bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50`}
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <button onClick={() => handleBtn('update')} disabled={!device.is_online} title="Aggiorna pacchetti" className={btnGhost}>
              📦 Aggiorna
            </button>
            <button onClick={() => handleBtn('reboot')} disabled={!device.is_online} title="Riavvia" className={btnGhost}>
              🔄 Riavvia
            </button>
            <button onClick={() => handleBtn('shutdown')} disabled={!device.is_online} title="Spegni" className={btnGhost}>
              <span className="text-red-500 dark:text-red-400">🔌</span> Spegni
            </button>
          </>
        )}
      </div>
    </div>
  );
}

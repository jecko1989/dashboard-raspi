import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Device } from '../types';
import { StatusBadge } from './StatusBadge';
import { KebabMenu } from './KebabMenu';
import { formatDateTime, formatLatency } from '../utils/format';
import { commandReboot, commandShutdown, commandUpdate } from '../services/api';

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

export function DeviceCard({ device, onEdit, onDelete }: DeviceCardProps) {
  const hasMenu = Boolean(onEdit || onDelete);
  const [cmdState, setCmdState] = useState<CmdState>({ phase: 'idle' });

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
      <Link to={`/devices/${device.id}`} className="block flex-1 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {device.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {device.hostname} · {device.ip_vpn}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge online={device.is_online} />
            {hasMenu && (
              <KebabMenu
                ariaLabel="Azioni device"
                items={[
                  ...(onEdit
                    ? [{ label: 'Modifica device', icon: '✏️', onSelect: () => onEdit(device) }]
                    : []),
                  ...(onDelete
                    ? [
                        {
                          label: 'Elimina device',
                          icon: '🗑️',
                          destructive: true,
                          onSelect: () => onDelete(device),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 ${
              device.is_online
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            VPN {device.is_online ? 'raggiungibile' : 'non raggiungibile'}
          </span>
          <span className="text-gray-400">
            {formatLatency(device.last_latency_ms)}
          </span>
          {device.alerts_muted && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              🔕 muted
            </span>
          )}
        </div>

        <p className="mt-1 text-xs text-gray-400">
          Ultima verifica: {formatDateTime(device.last_checked_at)}
        </p>

        {device.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
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
      </Link>

      {/* Barra azioni rapide */}
      <div className="flex items-center justify-end gap-1.5 border-t border-gray-100 px-3 py-2 dark:border-gray-700">
        {cmdState.phase === 'running' ? (
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Spinner />
            {CMD_LABELS[cmdState.cmd]}…
          </span>
        ) : cmdState.phase === 'done' ? (
          <span
            className={`text-xs font-medium ${
              cmdState.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {cmdState.msg}
          </span>
        ) : confirmCmd ? (
          <>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Confermare {CMD_LABELS[confirmCmd]}?
            </span>
            <button
              onClick={() => void runCmd(confirmCmd)}
              className={`${btnBase} bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50`}
            >
              ✓ Sì
            </button>
            <button
              onClick={() => setCmdState({ phase: 'idle' })}
              className={btnGhost}
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleBtn('update')}
              disabled={!device.is_online}
              title="Aggiorna pacchetti"
              className={btnGhost}
            >
              📦 Aggiorna
            </button>
            <button
              onClick={() => handleBtn('reboot')}
              disabled={!device.is_online}
              title="Riavvia"
              className={btnGhost}
            >
              🔄 Riavvia
            </button>
            <button
              onClick={() => handleBtn('shutdown')}
              disabled={!device.is_online}
              title="Spegni"
              className={btnGhost}
            >
              <span className="text-red-500 dark:text-red-400">⏻</span> Spegni
            </button>
          </>
        )}
      </div>
    </div>
  );
}

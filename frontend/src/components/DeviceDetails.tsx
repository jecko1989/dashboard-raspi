import { useState } from 'react';
import type { Device } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatDateTime, formatLatency } from '../utils/format';

// Pannello con i dettagli di un device e il comando SSH pronto da copiare.
interface DeviceDetailsProps {
  device: Device;
}

export function DeviceDetails({ device }: DeviceDetailsProps) {
  const [copied, setCopied] = useState(false);

  const copySsh = async () => {
    if (!device.ssh_command) return;
    await navigator.clipboard.writeText(device.ssh_command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">{device.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {device.hostname}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {device.alerts_muted && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              🔕 Alert silenziati
            </span>
          )}
          <StatusBadge online={device.is_online} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-gray-500">IP VPN</dt>
          <dd className="font-mono">{device.ip_vpn}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Luogo</dt>
          <dd>{device.luogo_id}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Utente SSH</dt>
          <dd className="font-mono">
            {device.ssh_username}:{device.ssh_port}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Latenza</dt>
          <dd>{formatLatency(device.last_latency_ms)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Ultima verifica</dt>
          <dd>{formatDateTime(device.last_checked_at)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Ultima metrica</dt>
          <dd>{formatDateTime(device.last_metric_at)}</dd>
        </div>
      </dl>

      {device.ssh_command && (
        <div className="mt-6">
          <p className="mb-1 text-xs font-semibold uppercase text-gray-400">
            Comando SSH
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-gray-100 px-3 py-2 text-xs dark:bg-gray-900">
              {device.ssh_command}
            </code>
            <button
              onClick={copySsh}
              className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              {copied ? 'Copiato!' : 'Copia'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import type { Device } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatDateTime, formatLatency } from '../utils/format';

// Card che rappresenta un singolo Raspberry.
interface DeviceCardProps {
  device: Device;
}

export function DeviceCard({ device }: DeviceCardProps) {
  return (
    <Link
      to={`/devices/${device.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {device.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {device.hostname} · {device.ip_vpn}
          </p>
        </div>
        <StatusBadge online={device.is_online} />
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
  );
}

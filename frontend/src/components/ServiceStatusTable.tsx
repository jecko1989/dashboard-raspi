import type { ServiceStatus } from '../types';
import { StatusBadge } from './StatusBadge';

function formatServiceLabel(serviceName: string): string {
  return serviceName.endsWith('.service')
    ? serviceName.slice(0, -'.service'.length)
    : serviceName;
}

// Tabella con lo stato dei servizi systemd di un device, con azioni opzionali.
interface ServiceStatusTableProps {
  services: ServiceStatus[];
  onStart?: (name: string) => void;
  onStop?: (name: string) => void;
  onRestart?: (name: string) => void;
  onViewLogs?: (name: string) => void;
  onRemove?: (name: string) => void;
}

export function ServiceStatusTable({
  services,
  onStart,
  onStop,
  onRestart,
  onViewLogs,
  onRemove,
}: ServiceStatusTableProps) {
  if (services.length === 0) {
    return <p className="text-sm text-gray-500">Nessun servizio monitorato.</p>;
  }
  const showActions = Boolean(onViewLogs || onStart || onStop || onRestart || onRemove);
  return (
    <div className="scrollbar-subtle -mx-1 overflow-x-auto px-1 pb-1">
      <table className="w-full min-w-0 table-fixed text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700">
            <th className="w-[38%] py-2">Servizio</th>
            <th className="w-[12%] py-2 text-center">Stato</th>
            {showActions && <th className="w-[50%] py-2 pr-1 text-right">Azioni</th>}
          </tr>
        </thead>
        <tbody>
          {services.map((svc) => (
            <tr key={svc.name} className="border-b border-gray-100 dark:border-gray-800">
              <td
                className="truncate py-2 pr-2 font-mono text-gray-800 dark:text-gray-200"
                title={svc.name}
              >
                {formatServiceLabel(svc.name)}
              </td>
              <td className="py-2 text-center align-middle">
                <StatusBadge online={svc.active} dotOnly />
              </td>
              {showActions && (
                <td className="py-2 pr-1 text-right whitespace-nowrap">
                  <div className="inline-flex items-center justify-end gap-1">
                  {onViewLogs && (
                    <button
                      aria-label={`Mostra log ${svc.name}`}
                      title={`Mostra log ${svc.name}`}
                      onClick={() => onViewLogs(svc.name)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        className="h-3.5 w-3.5 fill-current"
                      >
                        <path d="M4 3.5A1.5 1.5 0 0 0 2.5 5v10A1.5 1.5 0 0 0 4 16.5h12a1.5 1.5 0 0 0 1.5-1.5V5A1.5 1.5 0 0 0 16 3.5H4zm1.53 3.22a.75.75 0 0 1 1.06 0L8.87 9l-2.28 2.28a.75.75 0 0 1-1.06-1.06L6.75 9 5.53 7.78a.75.75 0 0 1 0-1.06zM9.5 10.25h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1 0-1.5z" />
                      </svg>
                    </button>
                  )}
                  {onStart && !svc.active && (
                    <button
                      aria-label={`Avvia ${svc.name}`}
                      title={`Avvia ${svc.name}`}
                      onClick={() => onStart(svc.name)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        className="h-3.5 w-3.5 fill-current"
                      >
                        <path d="M6 4.75v10.5c0 .58.63.94 1.13.65l8-5.25a.75.75 0 0 0 0-1.3l-8-5.25A.75.75 0 0 0 6 4.75z" />
                      </svg>
                    </button>
                  )}
                  {onRestart && svc.active && (
                    <button
                      aria-label={`Riavvia ${svc.name}`}
                      title={`Riavvia ${svc.name}`}
                      onClick={() => onRestart(svc.name)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded bg-amber-500 text-white hover:bg-amber-600"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        className="h-3.5 w-3.5 fill-current"
                      >
                        <path d="M10 3a7 7 0 0 1 6.93 6h-2.02a5 5 0 0 0-8.65-2.76L8.5 8.5H3V3l1.82 1.82A6.97 6.97 0 0 1 10 3zm-6.93 8h2.02a5 5 0 0 0 8.65 2.76L11.5 11.5H17V17l-1.82-1.82A6.97 6.97 0 0 1 10 17a7 7 0 0 1-6.93-6z" />
                      </svg>
                    </button>
                  )}
                  {onStop && (
                    <button
                      aria-label={`Ferma ${svc.name}`}
                      title={`Ferma ${svc.name}`}
                      onClick={() => onStop(svc.name)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        className="h-3.5 w-3.5 fill-current"
                      >
                        <rect x="5" y="5" width="10" height="10" rx="1.5" />
                      </svg>
                    </button>
                  )}
                  {onRemove && (
                    <button
                      aria-label={`Rimuovi ${svc.name}`}
                      title={`Rimuovi ${svc.name}`}
                      onClick={() => onRemove(svc.name)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent bg-red-600 text-white hover:bg-red-700"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        className="h-3.5 w-3.5 fill-current"
                      >
                        <path d="M7.5 2.5A1.5 1.5 0 0 0 6 4v.5H3.75a.75.75 0 0 0 0 1.5h.52l.63 9.13A2 2 0 0 0 6.9 17h6.2a2 2 0 0 0 2-1.87l.63-9.13h.52a.75.75 0 0 0 0-1.5H14V4a1.5 1.5 0 0 0-1.5-1.5h-5zM12.5 4H7.5V4h5v0zm-4 3.25a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0V8a.75.75 0 0 1 .75-.75zm3 0a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0V8a.75.75 0 0 1 .75-.75z" />
                      </svg>
                    </button>
                  )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

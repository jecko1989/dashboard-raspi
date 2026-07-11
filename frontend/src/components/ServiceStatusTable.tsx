import type { ServiceStatus } from '../types';
import { StatusBadge } from './StatusBadge';

// Tabella con lo stato dei servizi systemd di un device, con azioni opzionali.
interface ServiceStatusTableProps {
  services: ServiceStatus[];
  onRestart?: (name: string) => void;
  onViewLogs?: (name: string) => void;
}

export function ServiceStatusTable({
  services,
  onRestart,
  onViewLogs,
}: ServiceStatusTableProps) {
  if (services.length === 0) {
    return <p className="text-sm text-gray-500">Nessun servizio monitorato.</p>;
  }
  const showActions = Boolean(onRestart || onViewLogs);
  return (
    <div className="scrollbar-subtle -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[24rem] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700">
            <th className="py-2">Servizio</th>
            <th className="py-2">Stato</th>
            {showActions && <th className="py-2 text-right">Azioni</th>}
          </tr>
        </thead>
        <tbody>
          {services.map((svc) => (
            <tr key={svc.name} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2 font-mono text-gray-800 dark:text-gray-200">
                {svc.name}
              </td>
              <td className="py-2">
                <StatusBadge online={svc.active} />
              </td>
              {showActions && (
                <td className="py-2 text-right">
                  {onViewLogs && (
                    <button
                      onClick={() => onViewLogs(svc.name)}
                      className="mr-2 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    >
                      Log
                    </button>
                  )}
                  {onRestart && (
                    <button
                      onClick={() => onRestart(svc.name)}
                      className="rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                    >
                      Restart
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

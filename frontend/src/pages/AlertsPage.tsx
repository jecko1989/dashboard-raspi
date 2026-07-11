import { useEffect, useState } from 'react';
import type { Alert } from '../types';
import { getAlerts } from '../services/api';
import { formatDateTime } from '../utils/format';

const severityStyles: Record<string, string> = {
  info: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
  warning: 'border-amber-400 bg-amber-50 dark:bg-amber-900/20',
  critical: 'border-red-400 bg-red-50 dark:bg-red-900/20',
};

// Pagina con l'elenco degli alert attivi.
export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAlerts(true)
      .then(setAlerts)
      .catch((err) => setError((err as Error)?.message ?? 'Errore'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Caricamento…</p>;
  if (error) return <p className="text-red-600">Errore: {error}</p>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Alert attivi</h1>
      {alerts.length === 0 ? (
        <p className="text-sm text-gray-500">Nessun alert attivo. Tutto ok. ✅</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg border-l-4 p-4 ${
                severityStyles[a.severity] ?? severityStyles.warning
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-words font-semibold text-gray-900 dark:text-gray-100">
                  {a.type.toUpperCase()} · {a.device_id}
                </span>
                <span className="text-xs uppercase text-gray-500">{a.severity}</span>
              </div>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {a.message}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {formatDateTime(a.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

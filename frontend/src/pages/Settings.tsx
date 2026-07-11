import { useEffect, useState } from 'react';
import type { Thresholds } from '../types';
import { getThresholds } from '../services/api';

// Pagina impostazioni: mostra le soglie configurate per gli alert.
// Le soglie si modificano in config/devices.yaml (sezione "thresholds").
export function Settings() {
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getThresholds()
      .then(setThresholds)
      .catch((err) => setError((err as Error)?.message ?? 'Errore'));
  }, []);

  const rows: { label: string; value: string }[] = thresholds
    ? [
        { label: 'Temperatura alta', value: `> ${thresholds.temperature_celsius} °C` },
        { label: 'Disco pieno', value: `> ${thresholds.disk_percent} %` },
        { label: 'RAM alta', value: `> ${thresholds.ram_percent} %` },
        { label: 'CPU alta', value: `> ${thresholds.cpu_percent} %` },
        {
          label: 'Offline dopo',
          value: `${thresholds.offline_after_failures} check falliti`,
        },
      ]
    : [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Impostazioni</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Soglie alert</h2>
        {error && <p className="text-red-600">Errore: {error}</p>}
        {!thresholds && !error && <p className="text-gray-500">Caricamento…</p>}
        {thresholds && (
          <table className="w-full text-left text-sm">
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 text-gray-600 dark:text-gray-300">{r.label}</td>
                  <td className="py-2 text-right font-mono">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-4 text-xs text-gray-400">
          Le soglie si configurano in <code>config/devices.yaml</code> (sezione
          <code> thresholds</code>), con possibilità di override per singolo device.
        </p>
      </div>
    </div>
  );
}

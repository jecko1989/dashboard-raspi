import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Thresholds, ThresholdsUpdatePayload } from '../types';
import { getThresholds, updateThresholds } from '../services/api';

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm ' +
  'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

interface FormState {
  temperature_celsius: string;
  disk_percent: string;
  ram_percent: string;
  cpu_percent: string;
  offline_after_failures: string;
}

function toFormState(thresholds: Thresholds): FormState {
  return {
    temperature_celsius: String(thresholds.temperature_celsius),
    disk_percent: String(thresholds.disk_percent),
    ram_percent: String(thresholds.ram_percent),
    cpu_percent: String(thresholds.cpu_percent),
    offline_after_failures: String(thresholds.offline_after_failures),
  };
}

function parsePayload(form: FormState): ThresholdsUpdatePayload {
  return {
    temperature_celsius: Number(form.temperature_celsius),
    disk_percent: Number(form.disk_percent),
    ram_percent: Number(form.ram_percent),
    cpu_percent: Number(form.cpu_percent),
    offline_after_failures: Number(form.offline_after_failures),
  };
}

// Pagina impostazioni: mostra e, per admin, modifica le soglie globali alert.
export function Settings() {
  const { isAdmin } = useAuth();
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getThresholds()
      .then((data) => {
        setThresholds(data);
        setForm(toFormState(data));
      })
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

  const handleChange =
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setSuccess(null);
      setForm((current) =>
        current ? { ...current, [field]: e.target.value } : current,
      );
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const updated = await updateThresholds(parsePayload(form));
      setThresholds(updated);
      setForm(toFormState(updated));
      setSuccess('Soglie aggiornate con successo.');
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response
        ?.data?.detail;
      if (typeof detail === 'string') setError(detail);
      else setError((err as Error)?.message ?? 'Errore');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Impostazioni</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Soglie alert</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Persistite in config e applicate ai cicli di monitoraggio successivi.
            </p>
          </div>
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {isAdmin ? 'Modalità admin' : 'Sola lettura'}
          </span>
        </div>
        {error && <p className="text-red-600">Errore: {error}</p>}
        {success && <p className="text-green-600">{success}</p>}
        {!thresholds && !error && <p className="text-gray-500">Caricamento…</p>}
        {thresholds && !isAdmin && (
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
        {thresholds && isAdmin && form && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-300">Temperatura alta (°C)</span>
              <input
                type="number"
                min={1}
                max={120}
                step="0.1"
                value={form.temperature_celsius}
                onChange={handleChange('temperature_celsius')}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-300">Disco pieno (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                step="0.1"
                value={form.disk_percent}
                onChange={handleChange('disk_percent')}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-300">RAM alta (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                step="0.1"
                value={form.ram_percent}
                onChange={handleChange('ram_percent')}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-300">CPU alta (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                step="0.1"
                value={form.cpu_percent}
                onChange={handleChange('cpu_percent')}
                className={inputClass}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Offline dopo N check falliti</span>
              <input
                type="number"
                min={1}
                step="1"
                value={form.offline_after_failures}
                onChange={handleChange('offline_after_failures')}
                className={inputClass}
              />
            </label>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Salvataggio…' : 'Salva soglie'}
              </button>
            </div>
          </form>
        )}
        <p className="mt-4 text-xs text-gray-400">
          Le soglie globali restano in config/devices.yaml con possibilità di override per singolo device.
        </p>
      </div>
    </div>
  );
}

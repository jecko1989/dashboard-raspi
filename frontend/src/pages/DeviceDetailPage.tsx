import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DashboardEvent, Device, Metric } from '../types';
import {
  getDevice,
  getLatestMetric,
  getMetricHistory,
  getEvents,
  checkDevice,
  muteDeviceAlerts,
  unmuteDeviceAlerts,
  downloadMetricsCsv,
} from '../services/api';
import { DeviceDetails } from '../components/DeviceDetails';
import { MetricCard } from '../components/MetricCard';
import { MetricChart } from '../components/MetricChart';
import { EventTimeline } from '../components/EventTimeline';
import { DeviceCommands } from '../components/DeviceCommands';
import { DeviceSSHKey } from '../components/DeviceSSHKey';
import {
  formatLoad,
  formatPercent,
  formatTemp,
  formatUptime,
} from '../utils/format';

// Pagina dettaglio dispositivo.
// FASE 4: metriche + storico + eventi + comandi remoti sicuri (con conferma e audit).
export function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [metric, setMetric] = useState<Metric | null>(null);
  const [history, setHistory] = useState<Metric[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    if (!deviceId) return;
    try {
      const [dev, met, hist, evs] = await Promise.all([
        getDevice(deviceId),
        getLatestMetric(deviceId),
        getMetricHistory(deviceId, 100),
        getEvents(30),
      ]);
      setDevice(dev);
      setMetric(met);
      setHistory(hist);
      setEvents(evs.filter((e) => e.device_id === deviceId));
    } catch (err) {
      setError((err as Error)?.message ?? 'Errore');
    }
  }, [deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCheck = async () => {
    if (!deviceId) return;
    setChecking(true);
    try {
      await checkDevice(deviceId);
      await load();
    } catch (err) {
      setError((err as Error)?.message ?? 'Errore durante il check');
    } finally {
      setChecking(false);
    }
  };

  const handleToggleMute = async () => {
    if (!device) return;
    const updated = device.alerts_muted
      ? await unmuteDeviceAlerts(device.id)
      : await muteDeviceAlerts(device.id);
    setDevice(updated);
  };

  if (error) return <p className="text-red-600">Errore: {error}</p>;
  if (!device) return <p className="text-gray-500">Caricamento…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="break-words text-xl font-bold sm:text-2xl">{device.name}</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleToggleMute}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            {device.alerts_muted ? '🔔 Riattiva alert' : '🔕 Silenzia alert'}
          </button>
          <button
            onClick={handleCheck}
            disabled={checking}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {checking ? 'Verifica…' : 'Verifica ora'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DeviceDetails device={device} />

        <section className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <h3 className="mb-3 text-xl font-semibold">Metriche attuali</h3>
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <MetricCard label="CPU" value={formatPercent(metric?.cpu_percent)} />
            <MetricCard label="RAM" value={formatPercent(metric?.ram_percent)} />
            <MetricCard label="Disco" value={formatPercent(metric?.disk_percent)} />
            <MetricCard label="Temp." value={formatTemp(metric?.temperature_celsius)} />
            <MetricCard label="Load 1m" value={formatLoad(metric?.load_average_1m)} />
            <MetricCard label="Uptime" value={formatUptime(metric?.uptime_seconds)} />
          </div>
          {metric ? (
            <p className="mt-2 text-xs text-gray-400">
              {metric.os_version ?? '—'} · kernel {metric.kernel ?? '—'}
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              Nessuna metrica ancora raccolta. Configura SSH e premi "Verifica ora".
            </p>
          )}
        </section>
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Storico</h3>
        <div className="mb-3">
          <button
            onClick={() => downloadMetricsCsv(device.id)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            ⬇️ Esporta CSV
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <MetricChart title="CPU %" metrics={history} dataKey="cpu_percent" color="#3b82f6" unit="%" />
          <MetricChart title="RAM %" metrics={history} dataKey="ram_percent" color="#10b981" unit="%" />
          <MetricChart title="Disco %" metrics={history} dataKey="disk_percent" color="#f59e0b" unit="%" />
          <MetricChart title="Temperatura °C" metrics={history} dataKey="temperature_celsius" color="#ef4444" unit="°C" />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-lg font-semibold">Comandi remoti</h3>
          <DeviceCommands deviceId={device.id} deviceName={device.name} onChanged={load} />
        </div>
        <div>
          <h3 className="mb-3 text-lg font-semibold">Ultimi eventi</h3>
          <EventTimeline events={events} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Chiave SSH</h3>
        <DeviceSSHKey deviceId={device.id} />
      </section>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DashboardEvent, Device, Metric } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  clearEvents,
  getDevice,
  getEvents,
  getEventsCount,
  getLatestMetric,
  getMetricHistory,
  checkDevice,
  deleteDevice,
  downloadMetricsCsv,
  muteDeviceAlerts,
  unmuteDeviceAlerts,
} from '../services/api';
import { DeviceDetails } from '../components/DeviceDetails';
import { MetricCard } from '../components/MetricCard';
import { MetricChart } from '../components/MetricChart';
import { EventsPanel } from '../components/EventsPanel';
import { DeviceCommands } from '../components/DeviceCommands';
import { DeviceServicesPanel } from '../components/DeviceServicesPanel';
import {
  DeviceSSHKeyActions,
  DeviceSSHKeyDetails,
  useDeviceSSHKey,
} from '../components/DeviceSSHKey';
import { DeviceFormModal } from '../components/DeviceFormModal';
import { CommandModal } from '../components/CommandModal';
import {
  formatFanMode,
  formatFanRpm,
  formatLoad,
  formatPercent,
  formatTemp,
} from '../utils/format';

const metricTrends = [
  {
    label: 'CPU',
    value: (metric: Metric | null) => formatPercent(metric?.cpu_percent),
    dataKey: 'cpu_percent' as const,
    color: '#3b82f6',
    unit: '%',
  },
  {
    label: 'RAM',
    value: (metric: Metric | null) => formatPercent(metric?.ram_percent),
    dataKey: 'ram_percent' as const,
    color: '#10b981',
    unit: '%',
  },
  {
    label: 'Disco',
    value: (metric: Metric | null) => formatPercent(metric?.disk_percent),
    dataKey: 'disk_percent' as const,
    color: '#f59e0b',
    unit: '%',
  },
  {
    label: 'Temp.',
    value: (metric: Metric | null) => formatTemp(metric?.temperature_celsius),
    dataKey: 'temperature_celsius' as const,
    color: '#ef4444',
    unit: '°C',
  },
  {
    label: 'Load 1m',
    value: (metric: Metric | null) => formatLoad(metric?.load_average_1m),
    dataKey: 'load_average_1m' as const,
    color: '#0f766e',
  },
  {
    label: 'Ventola CPU',
    value: (metric: Metric | null) => formatFanRpm(metric?.fan_rpm),
    dataKey: 'fan_rpm' as const,
    color: '#7c3aed',
    unit: ' rpm',
  },
];

// Pagina dettaglio dispositivo.
// FASE 4: metriche + storico + eventi + comandi remoti sicuri (con conferma e audit).
export function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [metric, setMetric] = useState<Metric | null>(null);
  const [history, setHistory] = useState<Metric[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [eventsLast24hCount, setEventsLast24hCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const load = useCallback(async () => {
    if (!deviceId) return;
    try {
      const [dev, met, hist, evs] = await Promise.all([
        getDevice(deviceId),
        getLatestMetric(deviceId),
        getMetricHistory(deviceId, 100),
        getEvents(200, { deviceId }),
      ]);
      setDevice(dev);
      setMetric(met);
      setHistory(hist);
      setEvents(evs);
      const count = await getEventsCount({ deviceId, sinceHours: 24 });
      setEventsLast24hCount(count);
    } catch (err) {
      setError((err as Error)?.message ?? 'Errore');
    }
  }, [deviceId]);

  const sshKeyController = useDeviceSSHKey(device?.id ?? deviceId ?? '');

  const handleClearEvents = async () => {
    if (!deviceId) return;
    await clearEvents({ deviceId });
    setEvents([]);
    setEventsLast24hCount(0);
  };

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

  const handleDelete = async () => {
    if (!device) return;
    setDeletingBusy(true);
    try {
      await deleteDevice(device.id);
      navigate('/');
    } catch {
      setError('Eliminazione del device non riuscita.');
      setDeleting(false);
    } finally {
      setDeletingBusy(false);
    }
  };

  if (error) return <p className="text-red-600">Errore: {error}</p>;
  if (!device) return <p className="text-gray-500">Caricamento…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="break-words text-xl font-bold sm:text-2xl">{device.name}</h1>
        <div className="flex flex-wrap gap-2">
          <EventsPanel
            events={events}
            scope={{ kind: 'device', deviceId: device.id, deviceName: device.name }}
            title="Eventi"
            badgeCount={eventsLast24hCount}
            onClearEvents={isAdmin ? handleClearEvents : undefined}
          />
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
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            ✏️ Modifica
          </button>
          <button
            onClick={() => setDeleting(true)}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            🗑️ Elimina
          </button>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-6 xl:grid-cols-2">
        <DeviceDetails device={device} metric={metric} />

        <section className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold">Prestazioni</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Valori correnti e trend recente per ogni metrica.
              </p>
            </div>
            <button
              onClick={() => downloadMetricsCsv(device.id)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              ⬇️ Esporta CSV
            </button>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {metricTrends.map((item) => (
              (() => {
                const fanModeLabel = item.dataKey === 'fan_rpm'
                  ? formatFanMode(metric?.fan_mode)
                  : null;
                const cardLabel = fanModeLabel ? `${item.label} (${fanModeLabel})` : item.label;
                return (
              <MetricCard
                key={item.label}
                label={cardLabel}
                value={item.value(metric)}
                trend={
                  <MetricChart
                    metrics={history}
                    dataKey={item.dataKey}
                    color={item.color}
                    unit={item.unit}
                    compact
                    title={cardLabel}
                  />
                }
              />
                );
              })()
            ))}
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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div>
          <h3 className="mb-3 text-lg font-semibold">Comandi remoti</h3>
          <DeviceCommands
            deviceId={device.id}
            deviceName={device.name}
            deviceLanAddress={device.ip_vpn}
            onChanged={load}
            leadingActions={<DeviceSSHKeyActions controller={sshKeyController} />}
            afterMystSection={<DeviceSSHKeyDetails controller={sshKeyController} />}
          />
        </div>
        <div>
          <DeviceServicesPanel
            deviceId={device.id}
            deviceLanAddress={device.ip_vpn}
            onChanged={load}
          />
        </div>
      </section>

      {editing && (
        <DeviceFormModal
          open
          device={device}
          onClose={() => setEditing(false)}
          onSaved={(updated) => setDevice(updated)}
        />
      )}

      <CommandModal
        open={deleting}
        title="Elimina device"
        destructive
        confirmLabel={deletingBusy ? 'Eliminazione…' : 'Elimina'}
        description={
          <>
            Vuoi eliminare il device <strong>{device.name}</strong>? Verranno rimossi
            anche metriche, alert ed eventi associati. L'operazione non è reversibile.
          </>
        }
        onConfirm={handleDelete}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}

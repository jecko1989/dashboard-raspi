import { useCallback, useEffect, useState } from 'react';
import type { ServiceStatus } from '../types';
import {
  commandRestartService,
  commandStartService,
  commandStopService,
  getServiceLogs,
  getServices,
} from '../services/api';
import { ServiceStatusTable } from './ServiceStatusTable';

interface DeviceServicesPanelProps {
  deviceId: string;
}

export function DeviceServicesPanel({ deviceId }: DeviceServicesPanelProps) {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [logs, setLogs] = useState<{ service: string; content: string } | null>(null);
  const [result, setResult] = useState<{ status: 'success' | 'error'; detail: string } | null>(
    null,
  );

  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    try {
      setServices(await getServices(deviceId));
    } catch {
      setServices([]);
    } finally {
      setLoadingServices(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const viewLogs = async (service: string) => {
    try {
      const data = await getServiceLogs(deviceId, service);
      setLogs({ service, content: data.logs });
    } catch (err) {
      setLogs({ service, content: (err as Error)?.message ?? 'Errore' });
    }
  };

  const runServiceAction = async (
    service: string,
    action: 'start' | 'stop' | 'restart',
  ) => {
    const labels = {
      start: 'Avviare',
      stop: 'Fermare',
      restart: 'Riavviare',
    } as const;
    const ok = window.confirm(`${labels[action]} il servizio ${service}?`);
    if (!ok) return;
    setResult(null);
    try {
      const res =
        action === 'start'
          ? await commandStartService(deviceId, service)
          : action === 'stop'
            ? await commandStopService(deviceId, service)
            : await commandRestartService(deviceId, service);
      setResult({
        status: res.status === 'success' ? 'success' : 'error',
        detail: res.detail ?? `${service}: ${res.status}`,
      });
      await loadServices();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      setResult({ status: 'error', detail: detail ?? (err as Error)?.message ?? 'Errore' });
    }
  };

  const startService = (service: string) => runServiceAction(service, 'start');
  const stopService = (service: string) => runServiceAction(service, 'stop');
  const restartService = (service: string) => runServiceAction(service, 'restart');

  return (
    <section>
      <div className="mb-3">
        <h3 className="text-lg font-semibold">Servizi</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Stato dei servizi systemd e log rapidi.
        </p>
      </div>

      {loadingServices ? (
        <p className="text-sm text-gray-500">Caricamento servizi…</p>
      ) : (
        <ServiceStatusTable
          services={services}
          onStart={startService}
          onStop={stopService}
          onRestart={restartService}
          onViewLogs={viewLogs}
        />
      )}

      {result && (
        <div
          className={`mt-3 rounded-md border-l-4 p-3 text-sm ${
            result.status === 'success'
              ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
              : 'border-red-400 bg-red-50 dark:bg-red-900/20'
          }`}
        >
          {result.detail}
        </div>
      )}

      {logs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-xl dark:bg-gray-800 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Log · {logs.service}</h3>
              <button
                onClick={() => setLogs(null)}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm dark:border-gray-600"
              >
                Chiudi
              </button>
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-3 text-xs dark:bg-gray-900">
              {logs.content || '(nessun log)'}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
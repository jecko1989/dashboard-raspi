import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ServiceStatus } from '../types';
import {
  addMonitoredService,
  commandRestartService,
  commandStartService,
  commandStopService,
  getAvailableServices,
  getServiceLogs,
  getServices,
  removeMonitoredService,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ServiceStatusTable } from './ServiceStatusTable';
import { CommandModal } from './CommandModal';

interface DeviceServicesPanelProps {
  deviceId: string;
  deviceLanAddress?: string;
  onChanged?: () => void;
}

const SERVICE_NAME_RE = /^[A-Za-z0-9._@:-]{1,128}$/;
const TOAST_DURATION_MS = 3200;

type ToastState = {
  message: string;
  type: 'success' | 'error';
} | null;

type PendingServiceAction = {
  service: string;
  action: 'start' | 'stop' | 'restart';
} | null;

function formatServiceLabel(serviceName: string): string {
  return serviceName.endsWith('.service')
    ? serviceName.slice(0, -'.service'.length)
    : serviceName;
}

function compareServiceNames(a: string, b: string): number {
  return formatServiceLabel(a).localeCompare(formatServiceLabel(b), 'it', {
    sensitivity: 'base',
  });
}

function replaceServiceInText(text: string, serviceName: string): string {
  return text.split(serviceName).join(formatServiceLabel(serviceName));
}

export function DeviceServicesPanel({
  deviceId,
  onChanged,
}: DeviceServicesPanelProps) {
  const { isAdmin } = useAuth();
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [loadingServices, setLoadingServices] = useState(true);
  const [savingService, setSavingService] = useState(false);
  const [logs, setLogs] = useState<{ service: string; content: string } | null>(null);
  const [pendingAddService, setPendingAddService] = useState<string | null>(null);
  const [pendingRemoveService, setPendingRemoveService] = useState<string | null>(null);
  const [pendingServiceAction, setPendingServiceAction] =
    useState<PendingServiceAction>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [toastProgress, setToastProgress] = useState(100);

  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    try {
      const loaded = await getServices(deviceId);
      setServices([...loaded].sort((a, b) => compareServiceNames(a.name, b.name)));
    } catch {
      setServices([]);
    } finally {
      setLoadingServices(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  useEffect(() => {
    let mounted = true;
    const loadAvailable = async () => {
      try {
        const list = await getAvailableServices(deviceId);
        if (mounted) setAvailableServices(list);
      } catch {
        if (mounted) setAvailableServices([]);
      }
    };
    void loadAvailable();
    return () => {
      mounted = false;
    };
  }, [deviceId]);

  useEffect(() => {
    if (!toast) return;
    const startedAt = Date.now();
    setToastProgress(100);
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, TOAST_DURATION_MS - elapsed);
      setToastProgress((remaining / TOAST_DURATION_MS) * 100);
    }, 33);
    const timeoutId = window.setTimeout(() => {
      setToast(null);
      setToastProgress(100);
      window.clearInterval(intervalId);
    }, TOAST_DURATION_MS);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

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
    setToast(null);
    try {
      const res =
        action === 'start'
          ? await commandStartService(deviceId, service)
          : action === 'stop'
            ? await commandStopService(deviceId, service)
            : await commandRestartService(deviceId, service);
      setToast({
        type: res.status === 'success' ? 'success' : 'error',
        message:
          (res.detail
            ? replaceServiceInText(res.detail, service)
            : null) ?? `${formatServiceLabel(service)}: ${res.status}`,
      });
      await loadServices();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      setToast({
        type: 'error',
        message:
          (detail
            ? replaceServiceInText(detail, service)
            : null) ?? (err as Error)?.message ?? 'Errore',
      });
    }
  };

  const addService = async (serviceName: string) => {
    const service = serviceName.trim();
    if (!service) {
      setToast({ type: 'error', message: 'Seleziona un servizio dalla lista.' });
      return;
    }
    if (!SERVICE_NAME_RE.test(service)) {
      setToast({
        type: 'error',
        message: 'Nome servizio non valido. Usa solo lettere, numeri, . _ @ : e -',
      });
      return;
    }
    setSavingService(true);
    setToast(null);
    try {
      await addMonitoredService(deviceId, service);
      setSelectedService('');
      await loadServices();
      setToast({
        type: 'success',
        message: `Servizio ${formatServiceLabel(service)} aggiunto.`,
      });
      onChanged?.();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      setToast({ type: 'error', message: detail ?? (err as Error)?.message ?? 'Errore' });
    } finally {
      setSavingService(false);
    }
  };

  const requestAddService = () => {
    const service = selectedService.trim();
    if (!service) {
      setToast({ type: 'error', message: 'Seleziona un servizio dalla lista.' });
      return;
    }
    if (!SERVICE_NAME_RE.test(service)) {
      setToast({
        type: 'error',
        message: 'Nome servizio non valido. Usa solo lettere, numeri, . _ @ : e -',
      });
      return;
    }
    setPendingAddService(service);
  };

  const confirmAddService = async () => {
    if (!pendingAddService) return;
    const service = pendingAddService;
    setPendingAddService(null);
    await addService(service);
  };

  const removeService = async (service: string) => {
    setSavingService(true);
    setToast(null);
    try {
      await removeMonitoredService(deviceId, service);
      await loadServices();
      setToast({
        type: 'success',
        message: `Servizio ${formatServiceLabel(service)} rimosso.`,
      });
      onChanged?.();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      setToast({ type: 'error', message: detail ?? (err as Error)?.message ?? 'Errore' });
    } finally {
      setSavingService(false);
    }
  };

  const requestRemoveService = (service: string) => {
    setPendingRemoveService(service);
  };

  const confirmRemoveService = async () => {
    if (!pendingRemoveService) return;
    const service = pendingRemoveService;
    setPendingRemoveService(null);
    await removeService(service);
  };

  const requestServiceAction = (
    service: string,
    action: 'start' | 'stop' | 'restart',
  ) => {
    setPendingServiceAction({ service, action });
  };

  const confirmServiceAction = async () => {
    if (!pendingServiceAction) return;
    const { service, action } = pendingServiceAction;
    setPendingServiceAction(null);
    await runServiceAction(service, action);
  };

  const selectableServices = availableServices.filter(
    (name) => !services.some((svc) => svc.name === name),
  ).sort(compareServiceNames);

  const startService = (service: string) => requestServiceAction(service, 'start');
  const stopService = (service: string) => requestServiceAction(service, 'stop');
  const restartService = (service: string) => requestServiceAction(service, 'restart');

  return (
    <section>
      <div className="mb-3">
        <h3 className="text-lg font-semibold">Servizi</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Stato servizi, gestione monitoraggio e azioni operative unificate.
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      
        {isAdmin ? (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full">
              <select
                id={`available-services-${deviceId}`}
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">
                  {selectableServices.length > 0
                    ? 'Scegli un servizio...'
                    : 'Nessun servizio disponibile'}
                </option>
                {selectableServices.map((name) => (
                  <option key={name} value={name}>
                    {formatServiceLabel(name)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={requestAddService}
              disabled={savingService || !selectedService}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingService ? 'Salvataggio…' : 'Aggiungi servizio'}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Solo admin possono modificare la lista dei servizi monitorati.
          </p>
        )}
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
          onRemove={isAdmin ? requestRemoveService : undefined}
        />
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

      <CommandModal
        open={Boolean(pendingAddService)}
        title="Aggiungere servizio monitorato"
        description={
          <>
            Vuoi aggiungere il servizio{' '}
            <strong>
              {pendingAddService ? formatServiceLabel(pendingAddService) : ''}
            </strong>{' '}
            alla lista monitorata?
          </>
        }
        confirmLabel={savingService ? 'Salvataggio…' : 'Aggiungi'}
        onConfirm={confirmAddService}
        onCancel={() => setPendingAddService(null)}
      />

      <CommandModal
        open={Boolean(pendingRemoveService)}
        title="Rimuovere servizio monitorato"
        description={
          <>
            Vuoi rimuovere il servizio{' '}
            <strong>
              {pendingRemoveService ? formatServiceLabel(pendingRemoveService) : ''}
            </strong>{' '}
            dalla lista monitorata?
          </>
        }
        confirmLabel={savingService ? 'Rimozione…' : 'Rimuovi'}
        destructive
        onConfirm={confirmRemoveService}
        onCancel={() => setPendingRemoveService(null)}
      />

      <CommandModal
        open={Boolean(pendingServiceAction)}
        title={
          pendingServiceAction?.action === 'start'
            ? 'Avviare servizio'
            : pendingServiceAction?.action === 'restart'
              ? 'Riavviare servizio'
              : 'Fermare servizio'
        }
        description={
          <>
            Vuoi{' '}
            {pendingServiceAction?.action === 'start'
              ? 'avviare'
              : pendingServiceAction?.action === 'restart'
                ? 'riavviare'
                : 'fermare'}{' '}
            il servizio{' '}
            <strong>
              {pendingServiceAction
                ? formatServiceLabel(pendingServiceAction.service)
                : ''}
            </strong>
            ?
          </>
        }
        confirmLabel={
          pendingServiceAction?.action === 'start'
            ? 'Avvia'
            : pendingServiceAction?.action === 'restart'
              ? 'Riavvia'
              : 'Ferma'
        }
        destructive={pendingServiceAction?.action === 'stop'}
        onConfirm={confirmServiceAction}
        onCancel={() => setPendingServiceAction(null)}
      />

      {toast &&
        createPortal(
          <div className="pointer-events-none fixed right-4 top-4 z-[9999] overflow-hidden rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <p>{toast.message}</p>
            <div className="mt-2 h-1 w-full rounded bg-gray-200/80 dark:bg-gray-700/80">
              <div
                className={`h-full rounded transition-[width] duration-75 ease-linear ${
                  toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                } ml-auto`}
                style={{ width: `${toastProgress}%` }}
              />
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommandResult, ServiceStatus } from '../types';
import {
  getServices,
  getServiceLogs,
  commandReboot,
  commandShutdown,
  commandUpdate,
  commandRestartService,
  commandTailscale,
  commandMyst,
  downloadMystBackup,
  restoreMystBackup,
} from '../services/api';
import { CommandModal } from './CommandModal';
import { ServiceStatusTable } from './ServiceStatusTable';

type Pending =
  | { kind: 'reboot' }
  | { kind: 'shutdown' }
  | { kind: 'update' }
  | { kind: 'restart'; service: string }
  | { kind: 'tailscale'; exitNode: boolean; routes: boolean }
  | { kind: 'myst'; action: 'start' | 'stop' }
  | { kind: 'myst-restore'; file: File }
  | null;

interface DeviceCommandsProps {
  deviceId: string;
  onChanged?: () => void;
}

// Etichette leggibili per il banner "operazione in corso".
const RUNNING_LABELS: Record<NonNullable<Pending>['kind'], string> = {
  reboot: 'Riavvio in corso',
  shutdown: 'Spegnimento in corso',
  update: 'Aggiornamento pacchetti in corso',
  restart: 'Riavvio servizio in corso',
  tailscale: 'Configurazione Tailscale in corso',
  myst: 'Comando myst in corso',
  'myst-restore': 'Ripristino backup myst in corso',
};

// Piccolo spinner animato riutilizzabile.
function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}

// Pannello comandi remoti + gestione servizi, con conferma modale e audit.
export function DeviceCommands({ deviceId, onChanged }: DeviceCommandsProps) {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [pending, setPending] = useState<Pending>(null);
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningKind, setRunningKind] = useState<NonNullable<Pending>['kind'] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [logs, setLogs] = useState<{ service: string; content: string } | null>(null);
  const [backupRunning, setBackupRunning] = useState(false);
  const [mystError, setMystError] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

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

  // Cronometro del comando in corso (feedback "da quanto sta girando").
  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const execute = async () => {
    if (!pending) return;
    const current = pending;
    // Chiudi subito il modale per evitare una seconda esecuzione con doppio click.
    setPending(null);
    setRunningKind(current.kind);
    setRunning(true);
    setResult(null);
    try {
      let res: CommandResult;
      switch (current.kind) {
        case 'reboot':
          res = await commandReboot(deviceId);
          break;
        case 'shutdown':
          res = await commandShutdown(deviceId);
          break;
        case 'update':
          res = await commandUpdate(deviceId, dryRun);
          break;
        case 'restart':
          res = await commandRestartService(deviceId, current.service);
          break;
        case 'tailscale':
          res = await commandTailscale(deviceId, {
            exitNode: current.exitNode,
            routes: current.routes,
          });
          break;
        case 'myst':
          res = await commandMyst(deviceId, current.action);
          break;
        case 'myst-restore':
          res = await restoreMystBackup(deviceId, current.file);
          break;
      }
      setResult(res);
      await loadServices();
      onChanged?.();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      setResult({
        device_id: deviceId,
        command: current.kind,
        status: 'error',
        detail: detail ?? (err as Error)?.message ?? 'Errore',
      });
    } finally {
      setRunning(false);
      setRunningKind(null);
    }
  };

  const viewLogs = async (service: string) => {
    try {
      const data = await getServiceLogs(deviceId, service);
      setLogs({ service, content: data.logs });
    } catch (err) {
      setLogs({ service, content: (err as Error)?.message ?? 'Errore' });
    }
  };

  const handleBackup = async () => {
    setBackupRunning(true);
    setMystError(null);
    try {
      await downloadMystBackup(deviceId);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      setMystError(detail ?? (err as Error)?.message ?? 'Errore durante il backup');
    } finally {
      setBackupRunning(false);
    }
  };

  const onRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // consente di riselezionare lo stesso file
    if (file) setPending({ kind: 'myst-restore', file });
  };

  const modalConfig = (): {
    title: string;
    description: React.ReactNode;
    destructive: boolean;
    confirmLabel: string;
  } | null => {
    if (!pending) return null;
    switch (pending.kind) {
      case 'reboot':
        return {
          title: 'Riavviare il Raspberry?',
          description: 'Il dispositivo verrà riavviato e sarà irraggiungibile per qualche minuto.',
          destructive: true,
          confirmLabel: 'Riavvia',
        };
      case 'shutdown':
        return {
          title: 'Spegnere il Raspberry?',
          description:
            'Il dispositivo verrà spento e dovrà essere riacceso manualmente sul posto.',
          destructive: true,
          confirmLabel: 'Spegni',
        };
      case 'update':
        return {
          title: 'Aggiornare i pacchetti?',
          description: (
            <div className="space-y-3">
              <p>Esegue apt-get update e upgrade sul dispositivo.</p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                />
                Solo simulazione (dry-run): non installa nulla
              </label>
            </div>
          ),
          destructive: !dryRun,
          confirmLabel: dryRun ? 'Simula' : 'Aggiorna',
        };
      case 'restart':
        return {
          title: `Riavviare il servizio ${pending.service}?`,
          description: `Il servizio systemd "${pending.service}" verrà riavviato.`,
          destructive: true,
          confirmLabel: 'Riavvia servizio',
        };
      case 'tailscale': {
        const what =
          pending.exitNode && pending.routes
            ? 'exit node + subnet route'
            : pending.exitNode
              ? 'exit node'
              : 'subnet route';
        return {
          title: `Annunciare ${what} su Tailscale?`,
          description: (
            <div className="space-y-2">
              <p>
                Esegue <code>tailscale set</code> sul device per annunciare{' '}
                {what}.
              </p>
              {pending.routes && (
                <p className="text-xs text-gray-500">
                  La subnet LAN viene rilevata automaticamente sul device. Ricorda
                  di approvare la route nella admin console di Tailscale.
                </p>
              )}
            </div>
          ),
          destructive: false,
          confirmLabel: 'Annuncia',
        };
      }
      case 'myst':
        return {
          title: pending.action === 'stop' ? 'Fermare il nodo myst?' : 'Avviare il nodo myst?',
          description:
            pending.action === 'stop'
              ? 'Arresta il servizio Mysterium (consigliato sul nodo exit prima di streammare).'
              : 'Avvia il servizio Mysterium sul device.',
          destructive: pending.action === 'stop',
          confirmLabel: pending.action === 'stop' ? 'Ferma myst' : 'Avvia myst',
        };
      case 'myst-restore':
        return {
          title: 'Ripristinare il backup del nodo myst?',
          description: (
            <div className="space-y-2">
              <p>
                Il servizio verrà fermato, la data-dir sovrascritta con il backup
                <span className="font-mono"> {pending.file.name}</span> e il servizio
                riavviato.
              </p>
              <p className="text-xs text-gray-500">
                Dopo il ripristino ricordati di ri-rivendicare il nodo su
                mystnodes.com.
              </p>
            </div>
          ),
          destructive: true,
          confirmLabel: 'Ripristina',
        };
    }
  };

  const cfg = modalConfig();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setPending({ kind: 'update' })}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningKind === 'update' && <Spinner />}
          {runningKind === 'update' ? 'Aggiornamento…' : 'Aggiorna pacchetti'}
        </button>
        <button
          onClick={() => setPending({ kind: 'reboot' })}
          disabled={running}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Riavvia
        </button>
        <button
          onClick={() => setPending({ kind: 'shutdown' })}
          disabled={running}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Spegni
        </button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
          Tailscale
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPending({ kind: 'tailscale', exitNode: true, routes: false })}
            disabled={running}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Exit node
          </button>
          <button
            onClick={() => setPending({ kind: 'tailscale', exitNode: false, routes: true })}
            disabled={running}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Subnet routes
          </button>
          <button
            onClick={() => setPending({ kind: 'tailscale', exitNode: true, routes: true })}
            disabled={running}
            className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Exit node + routes
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
          Nodo Mysterium (myst)
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPending({ kind: 'myst', action: 'start' })}
            disabled={running}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Avvia myst
          </button>
          <button
            onClick={() => setPending({ kind: 'myst', action: 'stop' })}
            disabled={running}
            className="rounded-md bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ferma myst
          </button>
          <button
            onClick={handleBackup}
            disabled={backupRunning || running}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {backupRunning ? 'Backup…' : '⬇️ Backup nodo'}
          </button>
          <button
            onClick={() => restoreInputRef.current?.click()}
            disabled={running}
            className="rounded-md border border-cyan-600 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-cyan-400 dark:hover:bg-cyan-900/20"
          >
            ⬆️ Ripristina backup
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={onRestoreFile}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Il backup salva la data-dir del nodo (identità in <code>keystore/</code>)
          in uno .zip scaricato dal browser. Il ripristino richiede che il nodo
          myst sia già installato sul device.
        </p>
        {mystError && (
          <div className="mt-2 rounded-md border-l-4 border-amber-400 bg-amber-50 p-2 text-sm dark:bg-amber-900/20">
            {mystError}
          </div>
        )}
      </div>

      {running && runningKind && (
        <div className="flex items-start gap-3 rounded-md border-l-4 border-blue-400 bg-blue-50 p-3 text-sm dark:bg-blue-900/20">
          <span className="mt-0.5 text-blue-600 dark:text-blue-300">
            <Spinner />
          </span>
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">
              {RUNNING_LABELS[runningKind]}
              {elapsed > 0 && <span className="ml-1 font-normal">· {elapsed}s</span>}
            </p>
            <p className="mt-0.5 text-xs text-blue-700/80 dark:text-blue-300/80">
              {runningKind === 'update'
                ? 'apt-get update + upgrade: può richiedere alcuni minuti. Non chiudere la pagina né rilanciare il comando.'
                : 'Operazione in corso sul device. Attendi il completamento.'}
            </p>
          </div>
        </div>
      )}

      {result && (
        <div
          className={`rounded-md border-l-4 p-3 text-sm ${
            result.status === 'success'
              ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
              : 'border-red-400 bg-red-50 dark:bg-red-900/20'
          }`}
        >
          <p className="font-medium">
            {result.command} → {result.status}
          </p>
          {result.detail && (
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-300">
              {result.detail}
            </pre>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-3 text-lg font-semibold">Servizi</h3>
        {loadingServices ? (
          <p className="text-sm text-gray-500">Caricamento servizi…</p>
        ) : (
          <ServiceStatusTable
            services={services}
            onRestart={(name) => setPending({ kind: 'restart', service: name })}
            onViewLogs={viewLogs}
          />
        )}
      </div>

      <CommandModal
        open={Boolean(cfg)}
        title={cfg?.title ?? ''}
        description={cfg?.description ?? ''}
        destructive={cfg?.destructive ?? false}
        confirmLabel={cfg?.confirmLabel ?? 'Conferma'}
        onConfirm={execute}
        onCancel={() => setPending(null)}
      />

      {logs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
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
    </div>
  );
}

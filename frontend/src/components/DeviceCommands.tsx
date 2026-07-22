import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CommandResult } from '../types';
import {
  commandFanControl,
  getAvailableServices,
  commandReboot,
  commandShutdown,
  commandUpdate,
  commandRestartService,
  commandTailscale,
  downloadMystBackup,
  restoreMystBackup,
} from '../services/api';
import { CommandModal } from './CommandModal';
import { ShellModal } from './ShellModal';
import { useAuth } from '../context/AuthContext';
import { formatDurationShort } from '../utils/format';

type Pending =
  | { kind: 'reboot' }
  | { kind: 'shutdown' }
  | { kind: 'update' }
  | { kind: 'restart'; service: string }
  | { kind: 'tailscale'; exitNode: boolean; routes: boolean }
  | { kind: 'fan'; mode: 'pwm' | 'fixed'; rpm?: number }
  | { kind: 'myst-restore'; file: File }
  | null;

interface DeviceCommandsProps {
  deviceId: string;
  deviceName?: string;
  deviceLanAddress?: string;
  onChanged?: () => void;
  leadingActions?: ReactNode;
  afterMystSection?: ReactNode;
}

// Etichette leggibili per il banner "operazione in corso".
const RUNNING_LABELS: Record<NonNullable<Pending>['kind'], string> = {
  reboot: 'Riavvio in corso',
  shutdown: 'Spegnimento in corso',
  update: 'Aggiornamento pacchetti in corso',
  restart: 'Riavvio servizio in corso',
  tailscale: 'Configurazione Tailscale in corso',
  fan: 'Configurazione ventola in corso',
  'myst-restore': 'Ripristino backup myst in corso',
};

const TOAST_DURATION_MS = 3200;

type ToastState = {
  message: string;
  type: 'success' | 'error';
} | null;

const TOAST_KINDS: NonNullable<Pending>['kind'][] = ['reboot', 'shutdown', 'tailscale', 'fan'];

const COMMAND_LABEL_BY_KIND: Record<NonNullable<Pending>['kind'], string> = {
  reboot: 'reboot',
  shutdown: 'shutdown',
  update: 'update',
  restart: 'restart_service',
  tailscale: 'tailscale',
  fan: 'fan_control',
  'myst-restore': 'myst_restore',
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
export function DeviceCommands({
  deviceId,
  deviceName,
  deviceLanAddress,
  onChanged,
  leadingActions,
  afterMystSection,
}: DeviceCommandsProps) {
  const { isAdmin } = useAuth();
  const [pending, setPending] = useState<Pending>(null);
  const [dryRun, setDryRun] = useState(true);
  const [fanMode, setFanMode] = useState<'pwm' | 'fixed'>('pwm');
  const [fanRpm, setFanRpm] = useState('2500');
  const [running, setRunning] = useState(false);
  const [runningKind, setRunningKind] = useState<NonNullable<Pending>['kind'] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [toastProgress, setToastProgress] = useState(100);
  const [backupRunning, setBackupRunning] = useState(false);
  const [mystError, setMystError] = useState<string | null>(null);
  const [shellOpen, setShellOpen] = useState(false);
  const [runningTailscaleAction, setRunningTailscaleAction] = useState<{
    exitNode: boolean;
    routes: boolean;
  } | null>(null);
  const [installedServices, setInstalledServices] = useState<Set<string>>(new Set());
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const lanAddressForLinks = (deviceLanAddress || '').trim() || 'ip_raspberry';

  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    let mounted = true;
    const loadInstalledServices = async () => {
      try {
        const names = await getAvailableServices(deviceId);
        if (!mounted) return;
        setInstalledServices(
          new Set(names.map((name) => name.trim().toLowerCase())),
        );
      } catch {
        if (mounted) setInstalledServices(new Set());
      }
    };
    void loadInstalledServices();
    return () => {
      mounted = false;
    };
  }, [deviceId]);

  useEffect(() => {
    if (!toast) return;
    const startedAt = Date.now();
    setToastProgress(100);
    const intervalId = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const remaining = Math.max(0, TOAST_DURATION_MS - elapsedMs);
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

  const shouldShowToastForKind = (kind: NonNullable<Pending>['kind']): boolean =>
    TOAST_KINDS.includes(kind);

  const buildToastMessage = (command: string, status: string, detail?: string | null): string => {
    const normalizedDetail = detail ? detail.replace(/<ip_lan>/g, lanAddressForLinks) : '';
    return normalizedDetail ? `${command} -> ${status}\n${normalizedDetail}` : `${command} -> ${status}`;
  };

  const execute = async () => {
    if (!pending) return;
    const current = pending;
    // Chiudi subito il modale per evitare una seconda esecuzione con doppio click.
    setPending(null);
    setRunningKind(current.kind);
    setRunningTailscaleAction(
      current.kind === 'tailscale'
        ? { exitNode: current.exitNode, routes: current.routes }
        : null,
    );
    setRunning(true);
    setResult(null);
    setToast(null);
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
        case 'fan':
          res = await commandFanControl(deviceId, current.mode, current.rpm);
          break;
        case 'myst-restore':
          res = await restoreMystBackup(deviceId, current.file);
          break;
      }
      if (shouldShowToastForKind(current.kind)) {
        setToast({
          type: res.status === 'success' ? 'success' : 'error',
          message: buildToastMessage(res.command, res.status, res.detail),
        });
      } else {
        setResult(res);
      }
      onChanged?.();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      const errorDetail = detail ?? (err as Error)?.message ?? 'Errore';
      if (shouldShowToastForKind(current.kind)) {
        setToast({
          type: 'error',
          message: buildToastMessage(COMMAND_LABEL_BY_KIND[current.kind], 'error', errorDetail),
        });
      } else {
        setResult({
          device_id: deviceId,
          command: current.kind,
          status: 'error',
          detail: errorDetail,
        });
      }
    } finally {
      setRunning(false);
      setRunningKind(null);
      setRunningTailscaleAction(null);
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

  const mystSettingsUrl = `http://${lanAddressForLinks}:4449#settings`;

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
      case 'fan':
        return {
          title:
            pending.mode === 'pwm'
              ? 'Impostare ventola in modalità PWM automatica?'
              : 'Impostare ventola in modalità fixed?',
          description:
            pending.mode === 'pwm'
              ? 'Il controllo della ventola verrà riportato in automatico (PWM).'
              : `La ventola verrà impostata in fixed con target ${pending.rpm ?? 0} rpm.`,
          destructive: false,
          confirmLabel: 'Applica',
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
                Dopo il ripristino, per riscattare il nodo apri i settings locali:
                {' '}
                <a
                  href={mystSettingsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted hover:decoration-solid"
                >
                  {mystSettingsUrl}
                </a>
              </p>
            </div>
          ),
          destructive: true,
          confirmLabel: 'Ripristina',
        };
    }
  };

  const cfg = modalConfig();
  const replaceDetailPlaceholders = (value: string | null | undefined): string => {
    if (!value) return '';
    return value.replace(/<ip_lan>/g, lanAddressForLinks);
  };
  const linkifyText = (value: string): React.ReactNode[] => {
    const splitRegex = /(https?:\/\/[^\s]+)/g;
    const isUrl = /^https?:\/\/[^\s]+$/;
    return value.split(splitRegex).map((part, idx) => {
      if (isUrl.test(part)) {
        return (
          <a
            key={`url-${idx}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted hover:decoration-solid"
          >
            {part}
          </a>
        );
      }
      return <span key={`txt-${idx}`}>{part}</span>;
    });
  };
  const parsedFanRpm = Number.parseInt(fanRpm, 10);
  const canApplyFan = fanMode === 'pwm' || (Number.isFinite(parsedFanRpm) && parsedFanRpm >= 300 && parsedFanRpm <= 9000);
  const hasTailscale = installedServices.has('tailscaled.service');
  const hasMyst =
    installedServices.has('mysterium-node.service') ||
    installedServices.has('myst.service');
  const isRunningTailscale = (
    exitNode: boolean,
    routes: boolean,
  ): boolean =>
    runningKind === 'tailscale' &&
    runningTailscaleAction?.exitNode === exitNode &&
    runningTailscaleAction?.routes === routes;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {leadingActions}
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
        {isAdmin && (
          <button
            onClick={() => setShellOpen(true)}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            title="Apre una shell interattiva sul device (solo admin)"
          >
            <span aria-hidden="true">🖥️</span> Apri shell
          </button>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
          Ventola CPU
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">Modalità</span>
            <select
              value={fanMode}
              onChange={(e) => setFanMode(e.target.value as 'pwm' | 'fixed')}
              disabled={running}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="pwm">PWM (automatica)</option>
              <option value="fixed">Fixed</option>
            </select>
          </label>

          {fanMode === 'fixed' && (
            <label className="flex items-center gap-2 text-sm">
              <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">RPM target</span>
              <input
                type="number"
                min={300}
                max={9000}
                step={100}
                value={fanRpm}
                onChange={(e) => setFanRpm(e.target.value)}
                disabled={running}
                className="w-36 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
            </label>
          )}

          <button
            onClick={() =>
              setPending({
                kind: 'fan',
                mode: fanMode,
                rpm: fanMode === 'fixed' ? parsedFanRpm : undefined,
              })
            }
            disabled={running || !canApplyFan}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Applica ventola
          </button>
        </div>
        {fanMode === 'fixed' && !canApplyFan && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Inserisci un valore RPM tra 300 e 9000.
          </p>
        )}
      </div>

      {hasTailscale && (
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
          Tailscale
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPending({ kind: 'tailscale', exitNode: true, routes: false })}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunningTailscale(true, false) && <Spinner />}
            {isRunningTailscale(true, false) ? 'Applicazione…' : 'Exit node'}
          </button>
          <button
            onClick={() => setPending({ kind: 'tailscale', exitNode: false, routes: true })}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunningTailscale(false, true) && <Spinner />}
            {isRunningTailscale(false, true) ? 'Applicazione…' : 'Subnet routes'}
          </button>
          <button
            onClick={() => setPending({ kind: 'tailscale', exitNode: true, routes: true })}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunningTailscale(true, true) && <Spinner />}
            {isRunningTailscale(true, true) ? 'Applicazione…' : 'Exit node + routes'}
          </button>
        </div>
      </div>
      )}

      <div>
        {hasMyst && (
          <h3 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
            Nodo Mysterium (myst)
          </h3>
        )}
        <div className="flex flex-wrap gap-2">
          {hasMyst && (
            <>
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
            </>
          )}
          <input
            ref={restoreInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={onRestoreFile}
          />
        </div>
        {hasMyst && (
          <p className="mt-2 text-xs text-gray-500">
            Il backup salva la data-dir del nodo (identità in <code>keystore/</code>)
            in uno .zip scaricato dal browser. Il ripristino richiede che il nodo
            myst sia già installato sul device.
          </p>
        )}
        {mystError && (
          <div className="mt-2 rounded-md border-l-4 border-amber-400 bg-amber-50 p-2 text-sm dark:bg-amber-900/20">
            {mystError}
          </div>
        )}
        {afterMystSection && <div className="mt-3">{afterMystSection}</div>}
      </div>

      {running && runningKind && (
        <div className="flex items-start gap-3 rounded-md border-l-4 border-blue-400 bg-blue-50 p-3 text-sm dark:bg-blue-900/20">
          <span className="mt-0.5 text-blue-600 dark:text-blue-300">
            <Spinner />
          </span>
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">
              {RUNNING_LABELS[runningKind]}
              {elapsed > 0 && (
                <span className="ml-1 font-normal">· {formatDurationShort(elapsed)}</span>
              )}
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
            <div className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-600 dark:text-gray-300">
              {linkifyText(replaceDetailPlaceholders(result.detail))}
            </div>
          )}
        </div>
      )}

      {toast &&
        createPortal(
          <div className="pointer-events-none fixed right-4 top-4 z-[9999] overflow-hidden rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <p className="whitespace-pre-line">{toast.message}</p>
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

      <CommandModal
        open={Boolean(cfg)}
        title={cfg?.title ?? ''}
        description={cfg?.description ?? ''}
        destructive={cfg?.destructive ?? false}
        confirmLabel={cfg?.confirmLabel ?? 'Conferma'}
        onConfirm={execute}
        onCancel={() => setPending(null)}
      />

      {isAdmin && (
        <ShellModal
          open={shellOpen}
          deviceId={deviceId}
          deviceName={deviceName ?? deviceId}
          onClose={() => setShellOpen(false)}
        />
      )}
    </div>
  );
}

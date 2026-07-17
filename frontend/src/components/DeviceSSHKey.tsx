import { useState } from 'react';
import type { SSHKeyResult } from '../types';
import { generateSSHKey } from '../services/api';
import { CommandModal } from './CommandModal';

interface DeviceSSHKeyProps {
  deviceId: string;
}

// Copia testo negli appunti con feedback minimale.
function CopyButton({ text, label = 'Copia' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
    >
      {copied ? '✓ Copiato' : label}
    </button>
  );
}

// Pannello per generare una chiave SSH per il device (solo admin lato backend).
export function DeviceSSHKey({ deviceId }: DeviceSSHKeyProps) {
  const [confirmForce, setConfirmForce] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SSHKeyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsForce, setNeedsForce] = useState(false);

  const run = async (force: boolean) => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await generateSSHKey(deviceId, force);
      setResult(res);
      setNeedsForce(false);
    } catch (err) {
      const status = (err as { response?: { status?: number; data?: { detail?: string } } })
        .response;
      if (status?.status === 409) {
        // Chiave già esistente: proponi la sovrascrittura.
        setNeedsForce(true);
        setError(status.data?.detail ?? 'Una chiave esiste già.');
      } else {
        setError(status?.data?.detail ?? (err as Error)?.message ?? 'Errore');
      }
    } finally {
      setRunning(false);
      setConfirmForce(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setConfirmForce(false)}
          disabled={running}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        >
          🔑 Genera chiave SSH
        </button>
        {needsForce && (
          <button
            onClick={() => setConfirmForce(true)}
            disabled={running}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            Sovrascrivi chiave esistente
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Genera una coppia Ed25519 e (se possibile) salva la privata nel percorso
        del device. Poi installa la chiave pubblica sul Raspberry scegliendo uno
        dei due metodi mostrati qui sotto.
      </p>

      {running && <p className="text-sm text-gray-500">Generazione in corso…</p>}

      {error && (
        <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-md border-l-4 border-green-400 bg-green-50 p-3 text-sm dark:bg-green-900/20">
          <p className="font-medium">{result.detail}</p>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium">Chiave pubblica</span>
              <CopyButton text={result.public_key} label="Copia chiave pubblica" />
            </div>
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">
              {result.public_key}
            </pre>
          </div>

          <div>
            <div className="mb-1 font-medium">
              Metodo 1 (consigliato): esegui dal server dove gira la dashboard
            </div>
            <p className="mb-1 text-xs text-gray-600 dark:text-gray-300">
              Questo comando va eseguito sul computer/server che ospita la
              dashboard (dove esiste il file <code>.pub</code>). Non eseguirlo
              nel terminale del Raspberry.
            </p>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium">Comando installazione</span>
              <CopyButton text={result.install_command} label="Copia comando Metodo 1" />
            </div>
            <pre className="overflow-auto whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">
              {result.install_command}
            </pre>
          </div>

          <div>
            <div className="mb-1 font-medium">Metodo 2: esegui direttamente sul Raspberry</div>
            <p className="mb-1 text-xs text-gray-600 dark:text-gray-300">
              Se non puoi usare il Metodo 1, apri una sessione SSH sul Raspberry e
              aggiungi la chiave pubblica a <code>~/.ssh/authorized_keys</code>.
            </p>
            <pre className="overflow-auto whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">
              {result.manual_hint}
            </pre>
          </div>

          <div>
            <p className="font-medium">Checklist rapida</p>
            <ol className="ml-5 list-decimal text-xs text-gray-600 dark:text-gray-300">
              <li>Copia la chiave pubblica.</li>
              <li>Esegui Metodo 1 (consigliato) oppure Metodo 2.</li>
              <li>Verifica che il device sia raggiungibile via SSH dalla dashboard.</li>
            </ol>
          </div>

          {result.private_key && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-red-600">
                  Chiave privata — salvala tu in {result.key_path}
                </span>
                <CopyButton text={result.private_key} />
              </div>
              <p className="mb-1 text-xs text-red-600">
                Non è stato possibile salvarla su disco (es. cartella in sola
                lettura in Docker). Copiala ora: non verrà più mostrata.
              </p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">
                {result.private_key}
              </pre>
            </div>
          )}
        </div>
      )}

      <CommandModal
        open={confirmForce !== null}
        title={confirmForce ? 'Sovrascrivere la chiave esistente?' : 'Generare una chiave SSH?'}
        description={
          confirmForce
            ? 'Attenzione: sovrascrivere la chiave romperà l’accesso SSH finché non installi la nuova chiave pubblica sul Raspberry. Dopo la sovrascrittura reinstallala subito per evitare errori di monitoraggio.'
            : 'Verrà generata una nuova coppia di chiavi Ed25519 per questo device.'
        }
        destructive={Boolean(confirmForce)}
        confirmLabel={confirmForce ? 'Sovrascrivi' : 'Genera'}
        onConfirm={() => run(Boolean(confirmForce))}
        onCancel={() => setConfirmForce(null)}
      />
    </div>
  );
}

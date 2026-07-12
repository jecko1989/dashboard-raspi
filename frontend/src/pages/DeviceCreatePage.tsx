import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DeviceCreatePayload } from '../types';
import { useLuoghi } from '../hooks/useLuoghi';
import { createDevice } from '../services/api';

// Validatori allineati al backend (device_service).
const DEVICE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const HOSTNAME_RE =
  /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;
const SSH_USER_RE = /^[a-z_][a-z0-9_-]{0,31}$/;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function isValidIpVpn(value: string): boolean {
  if (IPV4_RE.test(value)) return true;
  // IPv6: presenza di ':' come euristica leggera (il backend valida in modo stretto).
  if (value.includes(':')) return true;
  return HOSTNAME_RE.test(value);
}

interface FormState {
  id: string;
  name: string;
  hostname: string;
  ip_vpn: string;
  luogo_id: string;
  ssh_username: string;
  ssh_port: string;
  description: string;
  tags: string;
}

const EMPTY: FormState = {
  id: '',
  name: '',
  hostname: '',
  ip_vpn: '',
  luogo_id: '',
  ssh_username: 'pi',
  ssh_port: '22',
  description: '',
  tags: '',
};

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm ' +
  'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

// Pagina di creazione device: form coerente con lo stile della dashboard.
export function DeviceCreatePage() {
  const navigate = useNavigate();
  const { luoghi, loading: loadingLuoghi } = useLuoghi();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update =
    (field: keyof FormState) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    const id = form.id.trim();
    const name = form.name.trim();
    const hostname = form.hostname.trim();
    const ipVpn = form.ip_vpn.trim();
    const sshUser = form.ssh_username.trim();
    const port = Number(form.ssh_port.trim());

    if (!DEVICE_ID_RE.test(id)) {
      next.id =
        "Usa minuscole, numeri, '-' o '_' (1-64 caratteri, inizio alfanumerico).";
    }
    if (!name) next.name = 'Il nome visualizzato è obbligatorio.';
    if (!HOSTNAME_RE.test(hostname)) next.hostname = 'Hostname non valido.';
    if (!isValidIpVpn(ipVpn)) {
      next.ip_vpn = 'Usa un IPv4, un IPv6 oppure un nome host/MagicDNS.';
    }
    if (!form.luogo_id) next.luogo_id = 'Seleziona un luogo.';
    if (!SSH_USER_RE.test(sshUser)) next.ssh_username = 'Utente SSH non valido.';
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      next.ssh_port = 'Porta non valida (1-65535).';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    const payload: DeviceCreatePayload = {
      id: form.id.trim(),
      name: form.name.trim(),
      hostname: form.hostname.trim(),
      ip_vpn: form.ip_vpn.trim(),
      luogo_id: form.luogo_id,
      ssh_username: form.ssh_username.trim(),
      ssh_port: Number(form.ssh_port.trim()),
      description: form.description.trim() || null,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    setSubmitting(true);
    try {
      const created = await createDevice(payload);
      // Vai alla pagina del nuovo device: conferma visiva senza refresh manuale.
      navigate(`/devices/${created.id}`);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response
        ?.data?.detail;
      if (typeof detail === 'string') {
        setServerError(detail);
      } else if (status === 409) {
        setServerError('Device già esistente (id, hostname o indirizzo).');
      } else if (status === 404) {
        setServerError('Luogo selezionato inesistente.');
      } else if (status === 400 || status === 422) {
        setServerError('Dati non validi: controlla i campi evidenziati.');
      } else {
        setServerError('Errore di connessione al server. Riprova.');
      }
      // I dati inseriti restano nel form per la correzione.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
        <span aria-hidden="true" className="mr-2">
          ➕
        </span>
        Aggiungi device
      </h2>

      {serverError && (
        <div className="mb-4 rounded-md border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {serverError}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Identificativo *</span>
            <input
              value={form.id}
              onChange={update('id')}
              placeholder="rpi-casa-mia-01"
              className={inputClass}
            />
            {errors.id && <p className="mt-1 text-xs text-red-600">{errors.id}</p>}
          </label>

          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Nome visualizzato *</span>
            <input
              value={form.name}
              onChange={update('name')}
              placeholder="Raspberry Casa Mia 01"
              className={inputClass}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </label>

          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Hostname *</span>
            <input
              value={form.hostname}
              onChange={update('hostname')}
              placeholder="rpi-casamia-01"
              className={inputClass}
            />
            {errors.hostname && (
              <p className="mt-1 text-xs text-red-600">{errors.hostname}</p>
            )}
          </label>

          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">
              Indirizzo VPN / Tailscale *
            </span>
            <input
              value={form.ip_vpn}
              onChange={update('ip_vpn')}
              placeholder="rpi-casa-mia oppure 100.x.y.z"
              className={inputClass}
            />
            {errors.ip_vpn && (
              <p className="mt-1 text-xs text-red-600">{errors.ip_vpn}</p>
            )}
          </label>

          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Luogo *</span>
            <select
              value={form.luogo_id}
              onChange={update('luogo_id')}
              disabled={loadingLuoghi}
              className={inputClass}
            >
              <option value="">{loadingLuoghi ? 'Caricamento…' : 'Seleziona…'}</option>
              {luoghi.map((lg) => (
                <option key={lg.id} value={lg.id}>
                  {lg.name}
                </option>
              ))}
            </select>
            {errors.luogo_id && (
              <p className="mt-1 text-xs text-red-600">{errors.luogo_id}</p>
            )}
          </label>

          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Utente SSH *</span>
            <input
              value={form.ssh_username}
              onChange={update('ssh_username')}
              placeholder="pi"
              className={inputClass}
            />
            {errors.ssh_username && (
              <p className="mt-1 text-xs text-red-600">{errors.ssh_username}</p>
            )}
          </label>

          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Porta SSH</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={form.ssh_port}
              onChange={update('ssh_port')}
              className={inputClass}
            />
            {errors.ssh_port && (
              <p className="mt-1 text-xs text-red-600">{errors.ssh_port}</p>
            )}
          </label>

          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">
              Tag (separati da virgola)
            </span>
            <input
              value={form.tags}
              onChange={update('tags')}
              placeholder="primario, test"
              className={inputClass}
            />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="text-gray-600 dark:text-gray-300">Descrizione</span>
            <textarea
              value={form.description}
              onChange={update('description')}
              rows={2}
              className={inputClass}
            />
          </label>
        </div>

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Stato online, latenza e raggiungibilità vengono rilevati automaticamente
          dal monitoraggio dopo il salvataggio.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? 'Salvataggio…' : 'Salva'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            disabled={submitting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}

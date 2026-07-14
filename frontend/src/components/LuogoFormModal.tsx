import { useState } from 'react';
import type { Luogo } from '../types';
import { createLuogo, updateLuogo } from '../services/api';

const LUOGO_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm ' +
  'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

interface LuogoFormModalProps {
  open: boolean;
  // Se presente, il modale e' in modalita' modifica; altrimenti creazione.
  luogo?: Luogo | null;
  onClose: () => void;
  onSaved?: (luogo: Luogo) => void;
}

// Modale per creare o modificare un luogo.
export function LuogoFormModal({ open, luogo, onClose, onSaved }: LuogoFormModalProps) {
  const isEdit = Boolean(luogo);
  const [id, setId] = useState(luogo?.id ?? '');
  const [name, setName] = useState(luogo?.name ?? '');
  const [order, setOrder] = useState(String(luogo?.display_order ?? 0));
  const [errors, setErrors] = useState<{ id?: string; name?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const validate = (): boolean => {
    const next: { id?: string; name?: string } = {};
    if (!isEdit && !LUOGO_ID_RE.test(id.trim())) {
      next.id =
        "Usa minuscole, numeri, '-' o '_' (1-64 caratteri, inizio alfanumerico).";
    }
    if (!name.trim()) next.name = 'Il nome del luogo è obbligatorio.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const displayOrder = Number(order.trim()) || 0;
      const saved = isEdit
        ? await updateLuogo(luogo!.id, { name: name.trim(), display_order: displayOrder })
        : await createLuogo({ id: id.trim(), name: name.trim(), display_order: displayOrder });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response
        ?.data?.detail;
      if (typeof detail === 'string') setServerError(detail);
      else if (status === 409) setServerError('Esiste già un luogo con questo identificativo.');
      else if (status === 400 || status === 422) setServerError('Dati non validi.');
      else setServerError('Errore di connessione al server. Riprova.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {isEdit ? 'Modifica luogo' : 'Aggiungi luogo'}
        </h3>

        {serverError && (
          <div className="mt-3 rounded-md border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {!isEdit && (
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-300">Identificativo *</span>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="casa_mia"
                className={inputClass}
              />
              {errors.id && <p className="mt-1 text-xs text-red-600">{errors.id}</p>}
            </label>
          )}

          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Nome *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Casa Mia"
              className={inputClass}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </label>

          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">
              Ordine di visualizzazione
            </span>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className={inputClass}
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

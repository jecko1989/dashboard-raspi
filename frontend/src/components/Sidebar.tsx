import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { Luogo } from '../types';
import { KebabMenu } from './KebabMenu';
import { CommandModal } from './CommandModal';
import { LuogoFormModal } from './LuogoFormModal';
import { deleteLuogo } from '../services/api';

// Sidebar con navigazione: overview globale + lista luoghi.
// Usata come rail fisso su desktop e come drawer su mobile (vedi Layout).
interface SidebarProps {
  luoghi: Luogo[];
  // Classi aggiuntive per adattare il contenitore (es. drawer mobile).
  className?: string;
  // Callback invocata dopo la navigazione (chiude il drawer su mobile).
  onNavigate?: () => void;
}

export function Sidebar({ luoghi, className = '', onNavigate }: SidebarProps) {
  const [creatingLuogo, setCreatingLuogo] = useState(false);
  const [editingLuogo, setEditingLuogo] = useState<Luogo | null>(null);
  const [deletingLuogo, setDeletingLuogo] = useState<Luogo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDeleteLuogo = async () => {
    if (!deletingLuogo) return;
    setBusy(true);
    setError(null);
    try {
      await deleteLuogo(deletingLuogo.id);
      setDeletingLuogo(null);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 409
          ? 'Il luogo contiene ancora dei device: rimuovili prima di eliminarlo.'
          : 'Eliminazione del luogo non riuscita.',
      );
      setDeletingLuogo(null);
    } finally {
      setBusy(false);
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 text-sm transition ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
    }`;

  return (
    <aside
      className={`w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      <h1 className="mb-6 px-3 text-lg font-bold text-gray-900 dark:text-gray-100">
        🖥️ RPi Dashboard
      </h1>
      <nav className="space-y-1" onClick={onNavigate}>
        <NavLink to="/" end className={linkClass}>
          <span aria-hidden="true" className="mr-2">
            📊
          </span>
          Overview
        </NavLink>
        <NavLink to="/alerts" className={linkClass}>
          <span aria-hidden="true" className="mr-2">
            🚨
          </span>
          Alert
        </NavLink>
        <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Luoghi
        </p>
        {error && (
          <p className="px-3 py-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        {luoghi.map((lg) => (
          <div key={lg.id} className="flex items-center gap-1">
            <NavLink to={`/luoghi/${lg.id}`} className="min-w-0 flex-1">
              {({ isActive }) => (
                <span className={linkClass({ isActive })}>
                  <span aria-hidden="true" className="mr-2">
                    🏠
                  </span>
                  {lg.name}
                  <span className="ml-1 text-xs text-gray-400">
                    ({lg.device_count})
                  </span>
                </span>
              )}
            </NavLink>
            <KebabMenu
              horizontal
              ariaLabel={`Azioni luogo ${lg.name}`}
              items={[
                {
                  label: 'Modifica luogo',
                  icon: '✏️',
                  onSelect: () => setEditingLuogo(lg),
                },
                {
                  label: 'Elimina luogo',
                  icon: '🗑️',
                  destructive: true,
                  onSelect: () => setDeletingLuogo(lg),
                },
              ]}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCreatingLuogo(true);
          }}
          className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <span aria-hidden="true" className="mr-2">
            ➕
          </span>
          Aggiungi luogo
        </button>
        <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Sistema
        </p>
        <NavLink to="/settings" className={linkClass}>
          <span aria-hidden="true" className="mr-2">
            ⚙️
          </span>
          Impostazioni
        </NavLink>
      </nav>

      <LuogoFormModal open={creatingLuogo} onClose={() => setCreatingLuogo(false)} />

      {editingLuogo && (
        <LuogoFormModal
          open
          luogo={editingLuogo}
          onClose={() => setEditingLuogo(null)}
        />
      )}

      <CommandModal
        open={Boolean(deletingLuogo)}
        title="Elimina luogo"
        destructive
        confirmLabel={busy ? 'Eliminazione…' : 'Elimina'}
        description={
          <>
            Vuoi eliminare il luogo <strong>{deletingLuogo?.name}</strong>?
            L'operazione è possibile solo se non contiene device.
          </>
        }
        onConfirm={confirmDeleteLuogo}
        onCancel={() => setDeletingLuogo(null)}
      />
    </aside>
  );
}

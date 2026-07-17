import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { Luogo } from '../types';
import { KebabMenu } from './KebabMenu';
import { CommandModal } from './CommandModal';
import { DeviceCreateModal } from './DeviceCreateModal';
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
  // Theme control
  dark: boolean;
  onDarkChange: (dark: boolean) => void;
}

export function Sidebar({ luoghi, className = '', onNavigate, dark, onDarkChange }: SidebarProps) {
  const [luoghiExpanded, setLuoghiExpanded] = useState(true);
  const [azioniExpanded, setAzioniExpanded] = useState(true);
  const [creatingDevice, setCreatingDevice] = useState(false);
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

  const actionButtonClass =
    'block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700';

  const sectionToggleClass = (expanded: boolean) =>
    `mt-4 flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-700 ${
      expanded ? '' : 'mb-5'
    }`;

  return (
    <aside
      className={`flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      <div className="overflow-y-auto p-4">
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
        <NavLink to="/settings" className={linkClass}>
          <span aria-hidden="true" className="mr-2">
            ⚙️
          </span>
          Impostazioni
        </NavLink>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLuoghiExpanded((v) => !v);
          }}
          className={sectionToggleClass(luoghiExpanded)}
          aria-expanded={luoghiExpanded}
        >
          <span>Luoghi</span>
          <span aria-hidden="true">{luoghiExpanded ? '▾' : '▸'}</span>
        </button>
        {luoghiExpanded && (
          <>
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
          </>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAzioniExpanded((v) => !v);
          }}
          className={sectionToggleClass(azioniExpanded)}
          aria-expanded={azioniExpanded}
        >
          <span>Azioni</span>
          <span aria-hidden="true">{azioniExpanded ? '▾' : '▸'}</span>
        </button>
        {azioniExpanded && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCreatingLuogo(true);
              }}
              className={actionButtonClass}
            >
              <span aria-hidden="true" className="mr-2">
                ➕
              </span>
              Aggiungi luogo
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCreatingDevice(true);
              }}
              className={actionButtonClass}
            >
              <span aria-hidden="true" className="mr-2">
                ➕
              </span>
              Aggiungi device
            </button>
          </>
        )}
      </nav>
      </div>

      {/* Spacer per spingere il tema in basso */}
      <div className="flex-1" />

      {/* Tema selector in fondo a sinistra */}
      <div className="border-t border-gray-200 py-4 px-4 dark:border-gray-700">
        <button
          onClick={() => onDarkChange(!dark)}
          className="flex w-full cursor-pointer items-center justify-start"
          aria-label="Cambia tema"
        >
          {/* Toggle switch */}
          <div 
            className="relative inline-flex h-8 w-16 items-center rounded-full transition-colors"
            style={{ backgroundColor: dark ? '#2563eb' : '#e5e7eb' }}
          >
            {/* Sfondo del toggle */}
            <span 
              className="absolute h-7 w-7 rounded-full bg-white shadow transition-all"
              style={{
                left: dark ? '2.125rem' : '1px',
                transitionDuration: '300ms',
              }}
            />
            {/* Icone */}
            <span 
              className="absolute left-1.5 text-sm transition-opacity"
              style={{ opacity: dark ? 0.3 : 1, transitionDuration: '300ms' }}
            >
              ☀️
            </span>
            <span 
              className="absolute right-1.5 text-sm transition-opacity"
              style={{ opacity: dark ? 1 : 0.3, transitionDuration: '300ms' }}
            >
              🌙
            </span>
          </div>
        </button>
      </div>

      <DeviceCreateModal open={creatingDevice} onClose={() => setCreatingDevice(false)} />

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

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
  className?: string;
  onNavigate?: () => void;
  dark: boolean;
  onDarkChange: (dark: boolean) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function Sidebar({ luoghi, className = '', onNavigate, dark, onDarkChange, collapsed = false, onToggleCollapsed }: SidebarProps) {
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
    `${collapsed ? 'flex justify-center' : 'block'} rounded-md px-3 py-2 text-sm transition ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
    }`;

  const actionButtonClass =
    'block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700';

  const sectionToggleClass =
    'mt-4 flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-700';

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 h-screen sticky top-0 transition-[width] duration-300 overflow-hidden ${collapsed ? 'w-14' : 'w-64'} ${className}`}
    >
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {/* Header con logo e pulsante toggle */}
        <div className={`mb-4 flex items-center ${collapsed ? 'flex-col gap-1' : 'justify-between'} px-2 pt-2`}>
          {collapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Espandi sidebar"
            >
              <span className="text-xl" aria-hidden="true">🖥️</span>
            </button>
          ) : (
            <>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                <NavLink to="/" end className="hover:opacity-80 transition-opacity">
                  🖥️ RPi Dashboard
                </NavLink>
              </h1>
              {onToggleCollapsed && (
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  aria-label="Comprimi sidebar"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        <nav className="space-y-1" onClick={onNavigate}>
        <NavLink to="/" end className={linkClass} title={collapsed ? 'Overview' : undefined}>
          <span aria-hidden="true" className={collapsed ? '' : 'mr-2'}>📊</span>
          {!collapsed && 'Overview'}
        </NavLink>
        <NavLink to="/alerts" className={linkClass} title={collapsed ? 'Alert' : undefined}>
          <span aria-hidden="true" className={collapsed ? '' : 'mr-2'}>🚨</span>
          {!collapsed && 'Alert'}
        </NavLink>
        <NavLink to="/settings" className={linkClass} title={collapsed ? 'Impostazioni' : undefined}>
          <span aria-hidden="true" className={collapsed ? '' : 'mr-2'}>⚙️</span>
          {!collapsed && 'Impostazioni'}
        </NavLink>

        {!collapsed && (
          <>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLuoghiExpanded((v) => !v);
          }}
          className={sectionToggleClass}
          aria-expanded={luoghiExpanded}
        >
          <span>Luoghi</span>
          <span
            aria-hidden="true"
            className="transition-transform duration-300"
            style={{ display: 'inline-block', transform: luoghiExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >▾</span>
        </button>
        <div
          className="grid transition-all duration-300 ease-in-out"
          style={{ gridTemplateRows: luoghiExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
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
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAzioniExpanded((v) => !v);
          }}
          className={sectionToggleClass}
          aria-expanded={azioniExpanded}
        >
          <span>Azioni</span>
          <span
            aria-hidden="true"
            className="transition-transform duration-300"
            style={{ display: 'inline-block', transform: azioniExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >▾</span>
        </button>
        <div
          className="grid transition-all duration-300 ease-in-out"
          style={{ gridTemplateRows: azioniExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
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
          </div>
        </div>
          </>
        )}
      </nav>
      </div>

      {/* Tema selector in fondo */}
      <div className={`py-4 ${collapsed ? 'flex justify-center px-0' : 'px-4'}`}>
        <button
          onClick={() => onDarkChange(!dark)}
          className={`flex cursor-pointer items-center ${collapsed ? 'justify-center' : 'justify-start w-full'}`}
          aria-label="Cambia tema"
          title={collapsed ? (dark ? 'Passa a tema chiaro' : 'Passa a tema scuro') : undefined}
        >
          {collapsed ? (
            <span className="text-xl">{dark ? '🌙' : '☀️'}</span>
          ) : (
          <div 
            className="relative inline-flex h-8 w-16 items-center rounded-full transition-colors"
            style={{ backgroundColor: dark ? '#2563eb' : '#e5e7eb' }}
          >
            <span 
              className="absolute h-7 w-7 rounded-full bg-white shadow transition-all"
              style={{
                left: dark ? '2.125rem' : '1px',
                transitionDuration: '300ms',
              }}
            />
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
          )}
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

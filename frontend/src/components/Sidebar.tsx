import { NavLink } from 'react-router-dom';
import type { Apartment } from '../types';

// Sidebar con navigazione: overview globale + lista appartamenti.
// Usata come rail fisso su desktop e come drawer su mobile (vedi Layout).
interface SidebarProps {
  apartments: Apartment[];
  // Classi aggiuntive per adattare il contenitore (es. drawer mobile).
  className?: string;
  // Callback invocata dopo la navigazione (chiude il drawer su mobile).
  onNavigate?: () => void;
}

export function Sidebar({ apartments, className = '', onNavigate }: SidebarProps) {
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
          Appartamenti
        </p>
        {apartments.map((ap) => (
          <NavLink key={ap.id} to={`/apartments/${ap.id}`} className={linkClass}>
            <span aria-hidden="true" className="mr-2">
              🏠
            </span>
            {ap.name}
            <span className="ml-1 text-xs text-gray-400">({ap.device_count})</span>
          </NavLink>
        ))}
        <NavLink to="/devices/new" className={linkClass}>
          <span aria-hidden="true" className="mr-2">
            ➕
          </span>
          Aggiungi device
        </NavLink>
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
    </aside>
  );
}

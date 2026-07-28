import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ChangePasswordModal } from './ChangePasswordModal';
import { EventsPanel } from './EventsPanel';
import { useLuoghi } from '../hooks/useLuoghi';
import { useNavBadges } from '../hooks/useNavBadges';
import { useAuth } from '../context/AuthContext';

// Layout principale: sidebar + area contenuti, con toggle dark mode.
interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { luoghi } = useLuoghi();
  const { username, isAdmin, logout } = useAuth();
  const location = useLocation();
  const { alertCount, events, eventsCount24h, scope, handleClearEvents } = useNavBadges();
  const [dark, setDark] = useState<boolean>(
    () => localStorage.getItem('theme') === 'dark',
  );
  // Stato del drawer di navigazione mobile.
  const [menuOpen, setMenuOpen] = useState(false);
  // Stato collapsed della sidebar desktop (persistito in localStorage).
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => localStorage.getItem('sidebar-collapsed') === 'true',
  );
  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      localStorage.setItem('sidebar-collapsed', String(!v));
      return !v;
    });
  };
  // Stato del dropdown utente
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Stato della modale cambio password
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  // Ref per il container del dropdown utente (click-outside)
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [dark]);

  // Chiudi il drawer quando cambia la rotta (navigazione mobile).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Chiudi il dropdown utente al click esterno.
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      {/* Rail fisso su desktop */}
      <Sidebar luoghi={luoghi} className="hidden lg:flex" dark={dark} onDarkChange={setDark} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />

      {/* Drawer di navigazione su mobile */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <Sidebar
            luoghi={luoghi}
            className="absolute inset-y-0 left-0 z-50 max-w-[85%] shadow-xl"
            onNavigate={() => setMenuOpen(false)}
            dark={dark}
            onDarkChange={setDark}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-md border border-gray-300 p-2 text-lg leading-none lg:hidden dark:border-gray-600"
            aria-label="Apri menu di navigazione"
          >
            ☰
          </button>
          
          {/* Badge alert ed eventi contestuali */}
          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/alerts"
              className={`relative rounded-md p-2 transition-colors ${
                alertCount > 0
                  ? 'text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              title={alertCount > 0 ? `${alertCount} alert attivi` : 'Nessun alert'}
            >
              <span aria-hidden="true" className="text-xl leading-none">🚨</span>
              {alertCount > 0 && (
                <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {alertCount}
                </span>
              )}
            </Link>
            <EventsPanel
              events={events}
              scope={scope}
              badgeCount={eventsCount24h}
              onClearEvents={isAdmin ? handleClearEvents : undefined}
            />
          </div>

          {/* Dropdown utente a destra */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className="text-xl leading-none">👤</span>
            </button>

            {/* Dropdown menu */}
            {userMenuOpen && (
              <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {/* Nome utente in alto */}
                <div className="border-b border-gray-200 px-4 py-2 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {username}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setChangePasswordOpen(true);
                    setUserMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  🔑 Cambia password
                </button>
                <button
                  onClick={() => {
                    logout();
                    setUserMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>

      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </div>
  );
}

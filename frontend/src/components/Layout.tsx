import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useLuoghi } from '../hooks/useLuoghi';
import { useAuth } from '../context/AuthContext';

// Layout principale: sidebar + area contenuti, con toggle dark mode.
interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { luoghi } = useLuoghi();
  const { username, logout } = useAuth();
  const location = useLocation();
  const [dark, setDark] = useState<boolean>(
    () => localStorage.getItem('theme') === 'dark',
  );
  // Stato del drawer di navigazione mobile.
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      {/* Rail fisso su desktop */}
      <Sidebar luoghi={luoghi} className="hidden lg:block" />

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
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-md border border-gray-300 p-2 text-lg leading-none lg:hidden dark:border-gray-600"
            aria-label="Apri menu di navigazione"
          >
            ☰
          </button>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {username && (
              <span className="hidden text-sm text-gray-500 dark:text-gray-400 sm:inline">
                👤 {username}
              </span>
            )}
            <button
              onClick={() => setDark((d) => !d)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
            >
              {dark ? '☀️' : '🌙'}
              <span className="ml-1 hidden sm:inline">{dark ? 'Light' : 'Dark'}</span>
            </button>
            <button
              onClick={logout}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

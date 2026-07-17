import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ChangePasswordModal } from './ChangePasswordModal';
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
  // Stato del dropdown utente
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Stato della modale cambio password
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

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
      <Sidebar luoghi={luoghi} className="hidden lg:block" dark={dark} onDarkChange={setDark} />

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
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-md border border-gray-300 p-2 text-lg leading-none lg:hidden dark:border-gray-600"
            aria-label="Apri menu di navigazione"
          >
            ☰
          </button>
          
          {/* Dropdown utente a destra */}
          <div className="relative ml-auto">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className="text-lg">👤</span>
            </button>

            {/* Dropdown menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
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

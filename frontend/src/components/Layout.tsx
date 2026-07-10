import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { useApartments } from '../hooks/useApartments';
import { useAuth } from '../context/AuthContext';

// Layout principale: sidebar + area contenuti, con toggle dark mode.
interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { apartments } = useApartments();
  const { username, logout } = useAuth();
  const [dark, setDark] = useState<boolean>(
    () => localStorage.getItem('theme') === 'dark',
  );

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

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <Sidebar apartments={apartments} />
      <div className="flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-700 dark:bg-gray-800">
          {username && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              👤 {username}
            </span>
          )}
          <button
            onClick={() => setDark((d) => !d)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
          >
            {dark ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button
            onClick={logout}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Logout
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

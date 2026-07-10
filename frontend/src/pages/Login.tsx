import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Pagina di login: autenticazione locale username/password (JWT).
export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 401
          ? 'Username o password non validi'
          : 'Errore di connessione al server',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-gray-100">
          🖥️ RPi Dashboard
        </h1>
        <p className="mb-4 text-sm text-gray-500">Accedi per continuare</p>

        {error && (
          <div className="mb-3 rounded-md border-l-4 border-red-400 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20">
            {error}
          </div>
        )}

        <label className="mb-3 block text-sm">
          <span className="text-gray-600 dark:text-gray-300">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>
        <label className="mb-4 block text-sm">
          <span className="text-gray-600 dark:text-gray-300">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? 'Accesso…' : 'Login'}
        </button>
      </form>
    </div>
  );
}

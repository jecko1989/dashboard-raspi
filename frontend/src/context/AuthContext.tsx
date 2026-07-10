import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { login as apiLogin, getMe, TOKEN_KEY } from '../services/api';

interface AuthContextValue {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [username, setUsername] = useState<string | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUsername(null);
  }, []);

  const login = useCallback(async (user: string, password: string) => {
    const accessToken = await apiLogin(user, password);
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
    try {
      const me = await getMe();
      setUsername(me.username);
    } catch {
      setUsername(user);
    }
  }, []);

  // Recupera lo username se c'è già un token al caricamento.
  useEffect(() => {
    if (token && !username) {
      getMe()
        .then((me) => setUsername(me.username))
        .catch(() => logout());
    }
  }, [token, username, logout]);

  // Logout automatico su evento 401 dall'interceptor axios.
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  const value = useMemo(
    () => ({
      token,
      username,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, username, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider');
  return ctx;
}

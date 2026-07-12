import { useCallback, useEffect, useState } from 'react';
import type { Luogo } from '../types';
import { getLuoghi } from '../services/api';

interface UseLuoghiResult {
  luoghi: Luogo[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

// Hook per caricare la lista dei luoghi.
export function useLuoghi(): UseLuoghiResult {
  const [luoghi, setLuoghi] = useState<Luogo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await getLuoghi();
      setLuoghi(data);
      setError(null);
    } catch (err) {
      setError((err as Error)?.message ?? 'Errore di rete');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // Aggiorna i conteggi (es. sidebar) quando cambia l'elenco device/luoghi.
    const onChange = () => void reload();
    window.addEventListener('devices:changed', onChange);
    return () => window.removeEventListener('devices:changed', onChange);
  }, [reload]);

  return { luoghi, loading, error, reload };
}

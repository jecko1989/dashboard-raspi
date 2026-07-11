import { useCallback, useEffect, useState } from 'react';
import type { Apartment } from '../types';
import { getApartments } from '../services/api';

interface UseApartmentsResult {
  apartments: Apartment[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

// Hook per caricare la lista degli appartamenti.
export function useApartments(): UseApartmentsResult {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await getApartments();
      setApartments(data);
      setError(null);
    } catch (err) {
      setError((err as Error)?.message ?? 'Errore di rete');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // Aggiorna i conteggi (es. sidebar) quando cambia l'elenco device.
    const onChange = () => void reload();
    window.addEventListener('devices:changed', onChange);
    return () => window.removeEventListener('devices:changed', onChange);
  }, [reload]);

  return { apartments, loading, error, reload };
}

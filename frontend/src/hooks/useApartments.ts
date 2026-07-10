import { useEffect, useState } from 'react';
import type { Apartment } from '../types';
import { getApartments } from '../services/api';

interface UseApartmentsResult {
  apartments: Apartment[];
  loading: boolean;
  error: string | null;
}

// Hook per caricare la lista degli appartamenti.
export function useApartments(): UseApartmentsResult {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getApartments()
      .then((data) => {
        if (active) setApartments(data);
      })
      .catch((err) => {
        if (active) setError(err?.message ?? 'Errore di rete');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { apartments, loading, error };
}

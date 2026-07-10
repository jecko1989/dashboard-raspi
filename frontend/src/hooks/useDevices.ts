import { useCallback, useEffect, useState } from 'react';
import type { Device } from '../types';
import { getDevices } from '../services/api';

interface UseDevicesResult {
  devices: Device[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

// Hook per caricare i device (opzionalmente filtrati per appartamento).
export function useDevices(apartmentId?: string): UseDevicesResult {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDevices(await getDevices(apartmentId));
    } catch (err) {
      setError((err as Error)?.message ?? 'Errore di rete');
    } finally {
      setLoading(false);
    }
  }, [apartmentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { devices, loading, error, reload };
}

import { useCallback, useEffect, useState } from 'react';
import type { Device } from '../types';
import { getDevices } from '../services/api';

interface UseDevicesResult {
  devices: Device[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

// Hook per caricare i device (opzionalmente filtrati per luogo).
export function useDevices(luogoId?: string): UseDevicesResult {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDevices(await getDevices(luogoId));
    } catch (err) {
      setError((err as Error)?.message ?? 'Errore di rete');
    } finally {
      setLoading(false);
    }
  }, [luogoId]);

  useEffect(() => {
    void reload();
    // Ricarica quando un device/luogo viene creato, modificato o eliminato.
    const onChange = () => void reload();
    window.addEventListener('devices:changed', onChange);
    return () => window.removeEventListener('devices:changed', onChange);
  }, [reload]);

  return { devices, loading, error, reload };
}

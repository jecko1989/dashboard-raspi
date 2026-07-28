import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { DashboardEvent } from '../types';
import { clearEvents, getAlerts, getEvents, getEventsCount } from '../services/api';
import { useDevices } from './useDevices';
import { useLuoghi } from './useLuoghi';
import type { EventsScope } from './useScopedEvents';

// Intervallo di aggiornamento automatico dei badge (ms).
const REFRESH_MS = 60_000;

interface NavBadges {
  alertCount: number;
  events: DashboardEvent[];
  eventsCount24h: number;
  scope: EventsScope;
  handleClearEvents: () => Promise<void>;
}

// Hook che espone contatori di alert ed eventi contestuali alla rotta corrente.
// - /                  → tutti i device
// - /luoghi/:luogoId   → device del luogo
// - /devices/:deviceId → singolo device
export function useNavBadges(): NavBadges {
  const location = useLocation();
  const { devices } = useDevices();
  const { luoghi } = useLuoghi();

  const deviceMatch = location.pathname.match(/^\/devices\/([^/]+)/);
  const luogoMatch = location.pathname.match(/^\/luoghi\/([^/]+)/);
  const deviceId = deviceMatch?.[1];
  const luogoId = luogoMatch?.[1];

  const scope = useMemo((): EventsScope => {
    if (deviceId) {
      const dev = devices.find((d) => d.id === deviceId);
      return { kind: 'device', deviceId, deviceName: dev?.name ?? deviceId };
    }
    if (luogoId) {
      const luogo = luoghi.find((l) => l.id === luogoId);
      const deviceIds = devices.filter((d) => d.luogo_id === luogoId).map((d) => d.id);
      return { kind: 'luogo', luogoName: luogo?.name ?? luogoId, deviceIds };
    }
    return { kind: 'all' };
  }, [deviceId, luogoId, devices, luoghi]);

  const [alertCount, setAlertCount] = useState(0);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [eventsCount24h, setEventsCount24h] = useState(0);

  const load = useCallback(async () => {
    // Alert: tutti, poi filtrati lato client per contesto.
    try {
      const all = await getAlerts(true);
      if (deviceId) {
        setAlertCount(all.filter((a) => a.device_id === deviceId).length);
      } else if (luogoId) {
        const ids = new Set(devices.filter((d) => d.luogo_id === luogoId).map((d) => d.id));
        setAlertCount(all.filter((a) => ids.has(a.device_id)).length);
      } else {
        setAlertCount(all.length);
      }
    } catch {
      setAlertCount(0);
    }

    // Lista eventi (per il pannello).
    try {
      setEvents(await getEvents(200, { deviceId, luogoId }));
    } catch {
      setEvents([]);
    }

    // Contatore eventi ultime 24h (badge).
    try {
      setEventsCount24h(await getEventsCount({ deviceId, luogoId, sinceHours: 24 }));
    } catch {
      setEventsCount24h(0);
    }
  }, [deviceId, luogoId, devices]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const handleClearEvents = useCallback(async () => {
    await clearEvents({ deviceId, luogoId });
    setEvents([]);
    setEventsCount24h(0);
  }, [deviceId, luogoId]);

  return { alertCount, events, eventsCount24h, scope, handleClearEvents };
}

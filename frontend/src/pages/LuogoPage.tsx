import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DashboardEvent } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLuoghi } from '../hooks/useLuoghi';
import { useDevices } from '../hooks/useDevices';
import { LuogoSection } from '../components/LuogoSection';
import { DeviceCreateModal } from '../components/DeviceCreateModal';
import { EventsPanel } from '../components/EventsPanel';
import { clearEvents, getEvents, getEventsCount } from '../services/api';

// Pagina di un singolo luogo.
export function LuogoPage() {
  const { luogoId } = useParams<{ luogoId: string }>();
  const { isAdmin } = useAuth();
  const { luoghi } = useLuoghi();
  const { devices, loading, error } = useDevices(luogoId);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [eventsLast24hCount, setEventsLast24hCount] = useState<number>(0);
  const [creatingDevice, setCreatingDevice] = useState(false);

  const luogo = luoghi.find((lg) => lg.id === luogoId);

  useEffect(() => {
    if (!luogoId) {
      setEvents([]);
      setEventsLast24hCount(0);
      return;
    }
    getEvents(200, { luogoId })
      .then(setEvents)
      .catch(() => setEvents([]));
    getEventsCount({ luogoId, sinceHours: 24 })
      .then(setEventsLast24hCount)
      .catch(() => setEventsLast24hCount(0));
  }, [luogoId]);

  const handleClearEvents = async () => {
    if (!luogoId) return;
    await clearEvents({ luogoId });
    setEvents([]);
    setEventsLast24hCount(0);
  };

  if (loading) return <p className="text-gray-500">Caricamento…</p>;
  if (error) return <p className="text-red-600">Errore: {error}</p>;
  if (!luogo) return <p className="text-gray-500">Luogo non trovato.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {luogo.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {devices.length} device nel luogo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EventsPanel
            events={events}
            scope={{
              kind: 'luogo',
              luogoName: luogo.name,
              deviceIds: devices.map((device) => device.id),
            }}
            title="Eventi"
            badgeCount={eventsLast24hCount}
            onClearEvents={isAdmin ? handleClearEvents : undefined}
          />
          <button
            onClick={() => setCreatingDevice(true)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            ➕ Aggiungi device
          </button>
        </div>
      </div>

      <LuogoSection luogo={luogo} devices={devices} />

      <DeviceCreateModal
        open={creatingDevice}
        initialLuogoId={luogo.id}
        onClose={() => setCreatingDevice(false)}
      />
    </div>
  );
}

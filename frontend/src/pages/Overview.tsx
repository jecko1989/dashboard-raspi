import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardEvent } from '../types';
import { useLuoghi } from '../hooks/useLuoghi';
import { useDevices } from '../hooks/useDevices';
import { LuogoSection } from '../components/LuogoSection';
import { LuogoFormModal } from '../components/LuogoFormModal';
import { EventTimeline } from '../components/EventTimeline';
import { refreshAll, getAlerts, getEvents } from '../services/api';

// Pagina overview globale: tutti i luoghi con i loro device.
export function Overview() {
  const { luoghi, loading: loadingLuoghi, error: errLuoghi } = useLuoghi();
  const { devices, loading: loadingDevs, error: errDevs, reload } = useDevices();
  const [refreshing, setRefreshing] = useState(false);
  const [creatingLuogo, setCreatingLuogo] = useState(false);
  const [alertCount, setAlertCount] = useState<number>(0);
  const [events, setEvents] = useState<DashboardEvent[]>([]);

  const loadSummary = () => {
    getAlerts(true)
      .then((a) => setAlertCount(a.length))
      .catch(() => setAlertCount(0));
    getEvents(15)
      .then(setEvents)
      .catch(() => setEvents([]));
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
      await reload();
      loadSummary();
    } finally {
      setRefreshing(false);
    }
  };

  if (loadingLuoghi || loadingDevs) {
    return <p className="text-gray-500">Caricamento…</p>;
  }
  if (errLuoghi || errDevs) {
    return (
      <p className="text-red-600">
        Errore di caricamento: {errLuoghi ?? errDevs}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            to="/alerts"
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              alertCount > 0
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            }`}
          >
            {alertCount > 0 ? `⚠️ ${alertCount} alert attivi` : '✅ Nessun alert'}
          </Link>
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {refreshing ? 'Aggiornamento…' : 'Aggiorna tutto'}
          </button>
          <button
            onClick={() => setCreatingLuogo(true)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            ➕ Nuovo luogo
          </button>
          <Link
            to="/devices/new"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            ➕ Nuovo device
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {luoghi.map((lg) => (
            <LuogoSection
              key={lg.id}
              luogo={lg}
              devices={devices.filter((d) => d.luogo_id === lg.id)}
            />
          ))}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Attività recente</h2>
          <EventTimeline events={events} />
        </div>
      </div>

      <LuogoFormModal open={creatingLuogo} onClose={() => setCreatingLuogo(false)} />
    </div>
  );
}

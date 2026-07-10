import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardEvent } from '../types';
import { useApartments } from '../hooks/useApartments';
import { useDevices } from '../hooks/useDevices';
import { ApartmentSection } from '../components/ApartmentSection';
import { EventTimeline } from '../components/EventTimeline';
import { refreshAll, getAlerts, getEvents } from '../services/api';

// Pagina overview globale: tutti gli appartamenti con i loro device.
export function Overview() {
  const { apartments, loading: loadingApts, error: errApts } = useApartments();
  const { devices, loading: loadingDevs, error: errDevs, reload } = useDevices();
  const [refreshing, setRefreshing] = useState(false);
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

  if (loadingApts || loadingDevs) {
    return <p className="text-gray-500">Caricamento…</p>;
  }
  if (errApts || errDevs) {
    return (
      <p className="text-red-600">
        Errore di caricamento: {errApts ?? errDevs}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="flex items-center gap-3">
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {apartments.map((ap) => (
            <ApartmentSection
              key={ap.id}
              apartment={ap}
              devices={devices.filter((d) => d.apartment_id === ap.id)}
            />
          ))}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Attività recente</h2>
          <EventTimeline events={events} />
        </div>
      </div>
    </div>
  );
}

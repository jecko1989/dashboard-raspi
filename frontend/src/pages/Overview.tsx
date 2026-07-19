import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardEvent } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLuoghi } from '../hooks/useLuoghi';
import { useDevices } from '../hooks/useDevices';
import { LuogoSection } from '../components/LuogoSection';
import { LuogoFormModal } from '../components/LuogoFormModal';
import { DeviceCreateModal } from '../components/DeviceCreateModal';
import { EventsPanel } from '../components/EventsPanel';
import { clearEvents, getAlerts, getEvents, getEventsCount, refreshAll } from '../services/api';

// Dropdown "Aggiungi" con click-outside per chiudersi.
function AggiungiMenu({
  onAggiungiLuogo,
  onAggiungiDevice,
}: {
  onAggiungiLuogo: () => void;
  onAggiungiDevice: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
      >
        ➕ Aggiungi
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => { onAggiungiLuogo(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            🏠 Aggiungi luogo
          </button>
          <button
            onClick={() => { onAggiungiDevice(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            🖥️ Aggiungi device
          </button>
        </div>
      )}
    </div>
  );
}

// Pagina overview globale: tutti i luoghi con i loro device.
export function Overview() {
  const { isAdmin } = useAuth();
  const { luoghi, loading: loadingLuoghi, error: errLuoghi } = useLuoghi();
  const { devices, loading: loadingDevs, error: errDevs, reload } = useDevices();
  const [refreshing, setRefreshing] = useState(false);
  const [creatingLuogo, setCreatingLuogo] = useState(false);
  const [creatingDevice, setCreatingDevice] = useState(false);
  const [alertCount, setAlertCount] = useState<number>(0);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [eventsLast24hCount, setEventsLast24hCount] = useState<number>(0);

  const loadSummary = () => {
    getAlerts(true)
      .then((a) => setAlertCount(a.length))
      .catch(() => setAlertCount(0));
    getEvents(200)
      .then(setEvents)
      .catch(() => setEvents([]));
    getEventsCount({ sinceHours: 24 })
      .then(setEventsLast24hCount)
      .catch(() => setEventsLast24hCount(0));
  };

  const handleClearEvents = async () => {
    await clearEvents();
    setEvents([]);
    setEventsLast24hCount(0);
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
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Stato complessivo dei luoghi e dei device monitorati.
          </p>
        </div>
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
          <EventsPanel
            events={events}
            scope={{ kind: 'all' }}
            title="Eventi"
            badgeCount={eventsLast24hCount}
            onClearEvents={isAdmin ? handleClearEvents : undefined}
          />
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {refreshing ? 'Aggiornamento…' : 'Aggiorna tutto'}
          </button>
          <AggiungiMenu
            onAggiungiLuogo={() => setCreatingLuogo(true)}
            onAggiungiDevice={() => setCreatingDevice(true)}
          />
        </div>
      </div>

      {luoghi.map((lg) => (
        <LuogoSection
          key={lg.id}
          luogo={lg}
          devices={devices.filter((d) => d.luogo_id === lg.id)}
        />
      ))}

      <DeviceCreateModal open={creatingDevice} onClose={() => setCreatingDevice(false)} />

      <LuogoFormModal open={creatingLuogo} onClose={() => setCreatingLuogo(false)} />
    </div>
  );
}

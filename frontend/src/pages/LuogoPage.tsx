import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DashboardEvent } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLuoghi } from '../hooks/useLuoghi';
import { useDevices } from '../hooks/useDevices';
import { LuogoSection } from '../components/LuogoSection';
import { DeviceCreateModal } from '../components/DeviceCreateModal';
import { CommandModal } from '../components/CommandModal';
import { LuogoFormModal } from '../components/LuogoFormModal';
import { EventsPanel } from '../components/EventsPanel';
import { clearEvents, deleteLuogo, getEvents, getEventsCount } from '../services/api';

// Pagina di un singolo luogo.
export function LuogoPage() {
  const { luogoId } = useParams<{ luogoId: string }>();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { luoghi } = useLuoghi();
  const { devices, loading, error } = useDevices(luogoId);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [eventsLast24hCount, setEventsLast24hCount] = useState<number>(0);
  const [creatingDevice, setCreatingDevice] = useState(false);
  const [editingLuogo, setEditingLuogo] = useState(false);
  const [deletingLuogo, setDeletingLuogo] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleDeleteLuogo = async () => {
    if (!luogo) return;
    setDeletingBusy(true);
    setDeleteError(null);
    try {
      await deleteLuogo(luogo.id);
      navigate('/');
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setDeleteError(
        status === 409
          ? 'Il luogo contiene ancora dei device: rimuovili prima di eliminarlo.'
          : 'Eliminazione del luogo non riuscita.',
      );
      setDeletingLuogo(false);
    } finally {
      setDeletingBusy(false);
    }
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
          <ActionsMenu
            onAggiungiDevice={() => setCreatingDevice(true)}
            onModificaLuogo={() => setEditingLuogo(true)}
            onEliminaLuogo={() => setDeletingLuogo(true)}
          />
        </div>
      </div>

      <LuogoSection luogo={luogo} devices={devices} hideHeader />

      <DeviceCreateModal
        open={creatingDevice}
        initialLuogoId={luogo.id}
        onClose={() => setCreatingDevice(false)}
      />

      <LuogoFormModal
        open={editingLuogo}
        luogo={luogo}
        onClose={() => setEditingLuogo(false)}
      />

      {deleteError && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-700 shadow-lg dark:bg-red-900/20 dark:text-red-300">
          {deleteError}
        </div>
      )}

      <CommandModal
        open={deletingLuogo}
        title="Elimina luogo"
        destructive
        confirmLabel={deletingBusy ? 'Eliminazione…' : 'Elimina'}
        description={
          <>
            Vuoi eliminare il luogo <strong>{luogo.name}</strong>? L’operazione è
            possibile solo se non contiene device.
          </>
        }
        onConfirm={handleDeleteLuogo}
        onCancel={() => setDeletingLuogo(false)}
      />
    </div>
  );
}

// Dropdown "Azioni" con click-outside per chiudersi.
function ActionsMenu({
  onAggiungiDevice,
  onModificaLuogo,
  onEliminaLuogo,
}: {
  onAggiungiDevice: () => void;
  onModificaLuogo: () => void;
  onEliminaLuogo: () => void;
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
        ⚙️ Azioni
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
            onClick={() => { onAggiungiDevice(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            🖥️ Aggiungi device
          </button>
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
          <button
            onClick={() => { onModificaLuogo(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            ✏️ Modifica luogo
          </button>
          <button
            onClick={() => { onEliminaLuogo(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            🗑️ Elimina luogo
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLuoghi } from '../hooks/useLuoghi';
import { useDevices } from '../hooks/useDevices';
import { LuogoSection } from '../components/LuogoSection';
import { LuogoFormModal } from '../components/LuogoFormModal';
import { DeviceCreateModal } from '../components/DeviceCreateModal';
import { refreshAll } from '../services/api';

// Dropdown "Aggiungi" con click-outside per chiudersi.
function AggiungiMenu({
  onAggiungiLuogo,
  onAggiungiDevice,
}: {
  onAggiungiLuogo: () => void;
  onAggiungiDevice: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        ref.current && !ref.current.contains(target) &&
        portalRef.current && !portalRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 208 });
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={handleToggle}
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

      {open && menuPos && createPortal(
        <div
          ref={portalRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-52 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
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
        </div>,
        document.body,
      )}
    </div>
  );
}

// Pagina overview globale: tutti i luoghi con i loro device.
export function Overview() {
  const { luoghi, loading: loadingLuoghi, error: errLuoghi } = useLuoghi();
  const { devices, loading: loadingDevs, error: errDevs, reload } = useDevices();
  const [refreshing, setRefreshing] = useState(false);
  const [creatingLuogo, setCreatingLuogo] = useState(false);
  const [creatingDevice, setCreatingDevice] = useState(false);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
      await reload();
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
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {luoghi.map((lg) => {
          const lgDevices = devices.filter((d) => d.luogo_id === lg.id);
          return (
            <div key={lg.id} style={{ flex: Math.max(lgDevices.length, 1) }} className="min-w-0 w-full sm:w-auto">
              <LuogoSection
                luogo={lg}
                devices={lgDevices}
              />
            </div>
          );
        })}
      </div>

      <DeviceCreateModal open={creatingDevice} onClose={() => setCreatingDevice(false)} />

      <LuogoFormModal open={creatingLuogo} onClose={() => setCreatingLuogo(false)} />
    </div>
  );
}

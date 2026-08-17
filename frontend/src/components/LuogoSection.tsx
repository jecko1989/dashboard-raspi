import { useState } from 'react';
import type { Device, Luogo } from '../types';
import { DeviceCard } from './DeviceCard';
import { KebabMenu } from './KebabMenu';
import { CommandModal } from './CommandModal';
import { LuogoFormModal } from './LuogoFormModal';
import { DeviceFormModal } from './DeviceFormModal';
import { deleteLuogo, deleteDevice } from '../services/api';

// Sezione che raggruppa i device di un luogo, con azioni CRUD (menu 3 puntini).
interface LuogoSectionProps {
  luogo: Luogo;
  devices: Device[];
  hideHeader?: boolean;
  // 'section' (default): sezione autonoma con la propria intestazione e la
  // propria griglia (usato dalla pagina dedicata al luogo). 'inline': non
  // renderizza ne' <section> ne' griglia propria, restituisce solo i singoli
  // elementi (chip intestazione + card device) cosi' che il chiamante possa
  // inserirli in un'unica griglia condivisa con altri luoghi (Overview: le
  // righe possono contenere la coda di un luogo e l'inizio del successivo).
  renderMode?: 'section' | 'inline';
}

export function LuogoSection({
  luogo,
  devices,
  hideHeader = false,
  renderMode = 'section',
}: LuogoSectionProps) {
  const [editingLuogo, setEditingLuogo] = useState(false);
  const [deletingLuogo, setDeletingLuogo] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDeleteLuogo = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteLuogo(luogo.id);
      setDeletingLuogo(false);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 409
          ? 'Il luogo contiene ancora dei device: rimuovili prima di eliminarlo.'
          : 'Eliminazione del luogo non riuscita.',
      );
      setDeletingLuogo(false);
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteDevice = async () => {
    if (!deletingDevice) return;
    setBusy(true);
    setError(null);
    try {
      await deleteDevice(deletingDevice.id);
      setDeletingDevice(null);
    } catch {
      setError('Eliminazione del device non riuscita.');
      setDeletingDevice(null);
    } finally {
      setBusy(false);
    }
  };

  const luogoActions = [
    { label: 'Modifica luogo', icon: '✏️', onSelect: () => setEditingLuogo(true) },
    {
      label: 'Elimina luogo',
      icon: '🗑️',
      destructive: true,
      onSelect: () => setDeletingLuogo(true),
    },
  ];

  const modals = (
    <>
      <LuogoFormModal
        open={editingLuogo}
        luogo={luogo}
        onClose={() => setEditingLuogo(false)}
      />

      <CommandModal
        open={deletingLuogo}
        title="Elimina luogo"
        destructive
        confirmLabel={busy ? 'Eliminazione…' : 'Elimina'}
        description={
          <>
            Vuoi eliminare il luogo <strong>{luogo.name}</strong>? L'operazione è
            possibile solo se non contiene device.
          </>
        }
        onConfirm={confirmDeleteLuogo}
        onCancel={() => setDeletingLuogo(false)}
      />

      {editingDevice && (
        <DeviceFormModal
          open
          device={editingDevice}
          onClose={() => setEditingDevice(null)}
        />
      )}

      <CommandModal
        open={Boolean(deletingDevice)}
        title="Elimina device"
        destructive
        confirmLabel={busy ? 'Eliminazione…' : 'Elimina'}
        description={
          <>
            Vuoi eliminare il device <strong>{deletingDevice?.name}</strong>? Verranno
            rimossi anche metriche, alert ed eventi associati. L'operazione non è
            reversibile.
          </>
        }
        onConfirm={confirmDeleteDevice}
        onCancel={() => setDeletingDevice(null)}
      />
    </>
  );

  if (renderMode === 'inline') {
    const errorBanner = error && (
      <div
        className="rounded-md border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
        style={{ gridColumn: '1 / -1' }}
      >
        {error}
      </div>
    );

    // Luogo con al massimo 1 device: intestazione e card si fondono in
    // un'unica unita' larga quanto uno slot normale (span 2 su 6), cosi'
    // piu' luoghi "singoli" possono stare affiancati nella stessa riga
    // invece di sprecare una riga intera a testa.
    if (devices.length <= 1) {
      return (
        <>
          <div className="grid-span-2 flex flex-col gap-2">
            {!hideHeader && (
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {luogo.name}
                </h2>
                <div className="ml-auto shrink-0">
                  <KebabMenu ariaLabel="Azioni luogo" items={luogoActions} />
                </div>
              </div>
            )}
            {devices.length === 1 ? (
              <DeviceCard
                device={devices[0]}
                onEdit={setEditingDevice}
                onDelete={setDeletingDevice}
              />
            ) : (
              <p className="text-sm text-gray-500">Nessun device configurato.</p>
            )}
          </div>

          {errorBanner}
          {modals}
        </>
      );
    }

    return (
      <>
        {!hideHeader && (
          <div
            className="flex min-h-[3rem] items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-700"
            style={{ gridColumn: '1 / -1' }}
          >
            <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
              {luogo.name}
            </h2>
            <span className="shrink-0 text-sm font-normal text-gray-500">
              ({devices.length} device)
            </span>
            <div className="ml-auto shrink-0">
              <KebabMenu ariaLabel="Azioni luogo" items={luogoActions} />
            </div>
          </div>
        )}

        {errorBanner}

        {devices.map((device, i) => {
          // La griglia condivisa usa 6 unita' per riga (2 per card in una
          // riga piena da 3). L'ultima riga di questo luogo, se incompleta,
          // allarga le sue card per riempire la larghezza invece di lasciare
          // spazio vuoto: 1 card rimasta -> tutta la riga, 2 rimaste -> meta'
          // ciascuna. (Il caso di 1 sola card totale e' gestito sopra, fuso
          // con l'intestazione).
          const rowIndex = Math.floor(i / 3);
          const isLastRow = rowIndex === Math.floor((devices.length - 1) / 3);
          const rowSize = isLastRow ? devices.length - rowIndex * 3 : 3;
          const span = 6 / rowSize;
          return (
            <div key={device.id} className={`grid-span-${span}`}>
              <DeviceCard
                device={device}
                onEdit={setEditingDevice}
                onDelete={setDeletingDevice}
              />
            </div>
          );
        })}

        {modals}
      </>
    );
  }

  return (
    <section className="mb-8 flex flex-col">
      {!hideHeader && (
        <div className="mb-3 flex min-h-[3rem] items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {luogo.name}
          </h2>
          <span className="text-sm font-normal text-gray-500">
            ({devices.length} device)
          </span>
          <KebabMenu ariaLabel="Azioni luogo" items={luogoActions} />
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-md border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {devices.length === 0 ? (
        <p className="text-sm text-gray-500">Nessun device configurato.</p>
      ) : (
        <div
          className="grid w-full gap-4"
          style={{
            // Max 3 colonne per riga, ma basato sulla larghezza reale del
            // contenitore (non del viewport), cosi' su schermi stretti le
            // colonne scendono a 2 o 1 invece di schiacciare le card.
            gridTemplateColumns:
              devices.length === 1
                ? '1fr'
                : devices.length === 2
                  ? 'repeat(2, 1fr)'
                  : 'repeat(auto-fit, minmax(max(260px, calc((100% - 2rem) / 3)), 1fr))',
            maxWidth: devices.length === 1 ? '720px' : undefined,
            margin: devices.length === 1 ? '0 auto' : undefined,
          }}
        >
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onEdit={setEditingDevice}
              onDelete={setDeletingDevice}
            />
          ))}
        </div>
      )}

      {modals}
    </section>
  );
}

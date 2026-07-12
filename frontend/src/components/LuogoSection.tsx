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
}

export function LuogoSection({ luogo, devices }: LuogoSectionProps) {
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

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {luogo.name}
        </h2>
        <span className="text-sm font-normal text-gray-500">
          ({devices.length} device)
        </span>
        <KebabMenu
          ariaLabel="Azioni luogo"
          items={[
            { label: 'Modifica luogo', icon: '✏️', onSelect: () => setEditingLuogo(true) },
            {
              label: 'Elimina luogo',
              icon: '🗑️',
              destructive: true,
              onSelect: () => setDeletingLuogo(true),
            },
          ]}
        />
      </div>

      {error && (
        <div className="mb-3 rounded-md border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {devices.length === 0 ? (
        <p className="text-sm text-gray-500">Nessun device configurato.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </section>
  );
}

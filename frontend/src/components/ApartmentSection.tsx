import type { Apartment, Device } from '../types';
import { DeviceCard } from './DeviceCard';

// Sezione che raggruppa i device di un appartamento.
interface ApartmentSectionProps {
  apartment: Apartment;
  devices: Device[];
}

export function ApartmentSection({ apartment, devices }: ApartmentSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {apartment.name}
        <span className="ml-2 text-sm font-normal text-gray-500">
          ({devices.length} device)
        </span>
      </h2>
      {devices.length === 0 ? (
        <p className="text-sm text-gray-500">Nessun device configurato.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}
    </section>
  );
}

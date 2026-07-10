import type { DashboardEvent } from '../types';
import { formatDateTime } from '../utils/format';

// Timeline verticale degli ultimi eventi.
interface EventTimelineProps {
  events: DashboardEvent[];
  // Classe Tailwind per l'altezza massima prima dello scroll.
  maxHeightClass?: string;
}

const dotColor: Record<string, string> = {
  status_change: 'bg-blue-500',
  alert: 'bg-amber-500',
  reboot: 'bg-purple-500',
};

export function EventTimeline({ events, maxHeightClass = 'max-h-96' }: EventTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-500">Nessun evento registrato.</p>;
  }
  return (
    <div className={`${maxHeightClass} scrollbar-subtle overflow-y-auto pl-2 pr-2`}>
      <ol className="relative border-l border-gray-200 dark:border-gray-700">
        {events.map((ev) => (
          <li key={ev.id} className="mb-4 ml-4">
            <span
              className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ${
                dotColor[ev.type] ?? 'bg-gray-400'
              }`}
            />
            <p className="text-sm text-gray-800 dark:text-gray-200">{ev.message}</p>
            <p className="text-xs text-gray-400">
              {ev.device_id ? `${ev.device_id} · ` : ''}
              {formatDateTime(ev.created_at)}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

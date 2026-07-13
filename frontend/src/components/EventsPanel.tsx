import { useState } from 'react';
import type { DashboardEvent } from '../types';
import { EventTimeline } from './EventTimeline';
import { useScopedEvents, type EventsScope } from '../hooks/useScopedEvents';

interface EventsPanelProps {
  events: DashboardEvent[];
  scope: EventsScope;
  title?: string;
  className?: string;
}

export function EventsPanel({
  events,
  scope,
  title = 'Eventi',
  className = '',
}: EventsPanelProps) {
  const [open, setOpen] = useState(false);
  const { events: scopedEvents, subtitle } = useScopedEvents(events, scope);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 ${className}`}
        title={subtitle}
      >
        <span aria-hidden="true">🔔</span>
        <span>{title}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-300">
          {scopedEvents.length}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-xl dark:bg-gray-800 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm dark:border-gray-600"
              >
                Chiudi
              </button>
            </div>
            <EventTimeline events={scopedEvents} maxHeightClass="max-h-[34rem]" />
          </div>
        </div>
      )}
    </>
  );
}
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DashboardEvent } from '../types';
import { EventTimeline } from './EventTimeline';
import { useScopedEvents, type EventsScope } from '../hooks/useScopedEvents';

const TOAST_DURATION_MS = 3200;

type ToastState = {
  message: string;
  type: 'success' | 'error';
} | null;

interface EventsPanelProps {
  events: DashboardEvent[];
  scope: EventsScope;
  title?: string;
  className?: string;
  badgeCount?: number;
  onClearEvents?: () => Promise<void>;
}

export function EventsPanel({
  events,
  scope,
  title = 'Eventi',
  className = '',
  badgeCount,
  onClearEvents,
}: EventsPanelProps) {
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [toastProgress, setToastProgress] = useState(100);
  const { events: scopedEvents, subtitle } = useScopedEvents(events, scope);

  useEffect(() => {
    if (!toast) return;
    const startedAt = Date.now();
    setToastProgress(100);
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, TOAST_DURATION_MS - elapsed);
      setToastProgress((remaining / TOAST_DURATION_MS) * 100);
    }, 33);
    const timeoutId = window.setTimeout(() => {
      setToast(null);
      setToastProgress(100);
      window.clearInterval(intervalId);
    }, TOAST_DURATION_MS);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  const handleOpenPanel = () => {
    setOpen(true);
  };

  const handleClosePanel = () => {
    setOpen(false);
  };

  const handleClearEvents = async () => {
    if (!onClearEvents || clearing) return;
    setOpen(false);
    setClearing(true);
    try {
      await onClearEvents();
      setToast({
        message: 'Eventi svuotati con successo.',
        type: 'success',
      });
    } catch (err) {
      setToast({
        message: (err as Error)?.message ?? 'Svuotamento eventi non riuscito.',
        type: 'error',
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenPanel}
        className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 ${className}`}
        title={subtitle}
      >
        <span aria-hidden="true">🔔</span>
        <span>{title}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-300">
          {badgeCount ?? scopedEvents.length}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleClosePanel}
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
              <div className="flex items-center gap-2">
                {onClearEvents && (
                  <button
                    onClick={() => void handleClearEvents()}
                    disabled={clearing}
                    className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                  >
                    {clearing ? 'Svuotamento…' : 'Svuota eventi'}
                  </button>
                )}
                <button
                  onClick={handleClosePanel}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm dark:border-gray-600"
                >
                  Chiudi
                </button>
              </div>
            </div>
            <EventTimeline events={scopedEvents} maxHeightClass="max-h-[34rem]" />
          </div>
        </div>
      )}

      {toast &&
        createPortal(
          <div className="pointer-events-none fixed right-4 top-4 z-[9999] overflow-hidden rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <p>{toast.message}</p>
            <div className="mt-2 h-1 w-full rounded bg-gray-200/80 dark:bg-gray-700/80">
              <div
                className={`h-full rounded transition-[width] duration-75 ease-linear ${
                  toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                } ml-auto`}
                style={{ width: `${toastProgress}%` }}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
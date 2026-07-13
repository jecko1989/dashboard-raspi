import { useMemo } from 'react';
import type { DashboardEvent } from '../types';

export type EventsScope =
  | { kind: 'all' }
  | { kind: 'luogo'; luogoName: string; deviceIds: string[] }
  | { kind: 'device'; deviceId: string; deviceName: string };

interface ScopedEventsResult {
  events: DashboardEvent[];
  subtitle: string;
}

export function useScopedEvents(
  events: DashboardEvent[],
  scope: EventsScope,
): ScopedEventsResult {
  return useMemo(() => {
    switch (scope.kind) {
      case 'all':
        return {
          events,
          subtitle: 'Tutti i device',
        };
      case 'luogo': {
        const allowed = new Set(scope.deviceIds);
        return {
          events: events.filter((event) => event.device_id && allowed.has(event.device_id)),
          subtitle: `Eventi dei device di ${scope.luogoName}`,
        };
      }
      case 'device':
        return {
          events: events.filter((event) => event.device_id === scope.deviceId),
          subtitle: `Eventi di ${scope.deviceName}`,
        };
    }
  }, [events, scope]);
}
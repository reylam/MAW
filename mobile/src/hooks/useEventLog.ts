import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/services/api';
import type { MawEvent } from '@/types/maw';

// Today's last 10 events for one crossing. Reloads whenever `refreshKey` changes.
export function useEventLog(crossingId: string | null, refreshKey: unknown) {
  const [events, setEvents] = useState<MawEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!crossingId) return;
    apiGet<MawEvent[]>(`/crossings/${encodeURIComponent(crossingId)}/events?date=today&limit=10`)
      .then((rows) => { setEvents(rows); setError(null); })
      .catch((e: Error) => setError(e.message));
  }, [crossingId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return { events, error, reload: load };
}

import { useCallback, useEffect, useState } from "react";
import { crossingService } from "../services/crossingService.js";
import { telemetryService } from "../services/telemetryService.js";
import { toCrossing } from "../lib/adapters.js";

// Crossings merged with their latest sensor readings. Pass an id to load one crossing.
export function useCrossingsLive(id) {
  const [data, setData] = useState(id ? null : []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const crossings = id ? crossingService.getById(id).then((res) => [res.data]) : crossingService.getAll({ limit: 100 }).then((res) => res.data || []);
    const telemetry = telemetryService.getAll(id ? { crossing_id: id, limit: 100 } : { limit: 500 })
      .then((res) => res.data || [])
      .catch(() => []);
    Promise.all([crossings, telemetry])
      .then(([rows, tel]) => {
        if (!active) return;
        const mapped = rows.filter(Boolean).map((c) => toCrossing(c, tel));
        setData(id ? mapped[0] ?? null : mapped);
      })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => load(), [load]);

  return { data, loading, error, reload: load };
}

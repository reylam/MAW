import { useCallback, useEffect, useState } from "react";
import { crossingService } from "../services/crossingService.js";
import { useMawFeed } from "../store/mawFeedStore.js";
import { applyLive, toCrossing } from "../lib/adapters.js";

/*
  Crossings with the live MAW state (sensor node data over WebSocket) applied.
  Pass an id to load one crossing. The record is refetched whenever a crossing
  changes state; status, train and sensor values update on every message.
*/
export function useCrossingsLive(id) {
  const [rows, setRows] = useState(id ? null : []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const live = useMawFeed((s) => s.states);
  const changeKey = useMawFeed((s) => s.changeKey);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const request = id ? crossingService.getById(id).then((res) => res.data) : crossingService.getAll({ limit: 100 }).then((res) => res.data || []);
    request
      .then((data) => { if (active) setRows(data); })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => load(), [load, changeKey]);

  const data = id
    ? (rows ? applyLive(toCrossing(rows), live[rows.id]) : null)
    : rows.map((c) => applyLive(toCrossing(c), live[c.id]));

  return { data, loading, error, reload: load };
}

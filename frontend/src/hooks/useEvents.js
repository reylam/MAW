import { useEffect, useState } from "react";
import { eventService } from "../services/eventService.js";

// `refreshKey`: pass a value that changes (e.g. the live feed changeKey) to refetch.
// Loading is only true until the first response, so live refreshes do not flicker.
export function useEvents(params = {}, refreshKey = 0) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const query = JSON.stringify(params);

  useEffect(() => {
    let active = true;
    eventService.getAll(JSON.parse(query))
      .then((res) => { if (active) { setData(res.data || []); setError(null); } })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, refreshKey]);

  return { data, loading, error };
}

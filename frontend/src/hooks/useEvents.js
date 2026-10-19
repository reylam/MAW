import { useEffect, useState } from "react";
import { eventService } from "../services/eventService.js";

// `refreshKey`: pass a value that changes (e.g. the live feed changeKey) to refetch.
export function useEvents(params = {}, refreshKey = 0) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    eventService.getAll(params)
      .then((res) => { if (active) setData(res.data || []); })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [JSON.stringify(params), refreshKey]);

  return { data, loading, error };
}

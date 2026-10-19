import { useEffect, useState } from "react";
import { telemetryService } from "../services/telemetryService.js";

export function useTelemetry(params = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    telemetryService.getAll(params)
      .then((res) => { if (active) setData(res.data || []); })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [JSON.stringify(params)]);

  return { data, loading, error };
}

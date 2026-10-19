import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const WS_URL = import.meta.env.VITE_WS_URL || API_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "") + "/ws";

// Live `crossing.state` for one crossing over the backend WebSocket (same feed as the petugas app).
export function useMawLive(crossingId) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws;
    let retry;
    let stopped = false;
    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.event === "crossing.state" && msg.data.crossing_id === crossingId) setState(msg.data);
        } catch { /* ignore malformed frames */ }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) retry = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => { stopped = true; clearTimeout(retry); ws?.close(); };
  }, [crossingId]);

  return { state, connected };
}

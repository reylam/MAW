import { WS_URL } from '@/config/env';
import { useMawStore } from '@/store/useMawStore';
import type { CrossingState } from '@/types/maw';

// Reconnecting WebSocket client for `crossing.state` events.

let socket: WebSocket | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retries = 0;
let stopped = true;

function connect() {
  const { setConnection, upsert } = useMawStore.getState();
  setConnection('connecting');
  const ws = new WebSocket(WS_URL);
  socket = ws;

  ws.onopen = () => {
    retries = 0;
    setConnection('open');
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(String(e.data)) as { event: string; data: CrossingState };
      if (msg.event === 'crossing.state') upsert(msg.data);
    } catch {
      // ignore malformed frames
    }
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    setConnection('closed');
    if (stopped) return;
    const delay = Math.min(10_000, 1000 * 2 ** retries++);
    retryTimer = setTimeout(connect, delay);
  };
  ws.onerror = () => ws.close();
}

export function startMawSocket() {
  if (!stopped) return;
  stopped = false;
  connect();
}

export function stopMawSocket() {
  stopped = true;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  const ws = socket;
  socket = null;
  ws?.close();
  useMawStore.getState().setConnection('closed');
}

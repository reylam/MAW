export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000/api';

// WebSocket lives on the same host as the API, at /ws.
export const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL ?? API_URL.replace(/^http/, 'ws').replace(/\/api\/?$/, '') + '/ws';

// Optional: pin this device to one crossing. Empty = first crossing the backend reports.
export const CROSSING_ID = process.env.EXPO_PUBLIC_CROSSING_ID || null;

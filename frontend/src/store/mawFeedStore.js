import { create } from "zustand";

/*
  One shared WebSocket to the backend (/ws) for the whole dashboard.
  - states:      latest `crossing.state` per crossing (same feed as the petugas app)
  - sim:         Simulation Center status (`sim.status`)
  - changeKey:   bumps when any crossing changes state, acknowledgement or device
                 status, so pages can refetch alerts/events exactly when something happened
  - deviceAlerts: devices that just went disconnected (drives the pop-up)
*/

import { WS_URL } from "../config/env.js";

export const useMawFeed = create((set) => ({
  connected: false,
  states: {},
  sim: { running: false },
  changeKey: 0,
  deviceAlerts: [],

  dismissDeviceAlerts: () => set({ deviceAlerts: [] }),

  receive: (msg) =>
    set((prev) => {
      if (msg.event === "sim.status") return { sim: msg.data };
      if (msg.event !== "crossing.state") return {};
      const s = msg.data;
      const old = prev.states[s.crossing_id];

      // Devices that went from connected (or unknown) to disconnected since the last message.
      const wasDown = new Map((old?.devices || []).map((d) => [d.id, d.status === "disconnected"]));
      const newlyDown = (s.devices || [])
        .filter((d) => d.status === "disconnected" && !wasDown.get(d.id))
        .map((d) => ({ id: d.id, name: d.name, crossing_id: s.crossing_id, crossing_name: s.crossing_name, at: Date.now() }));
      const stillDown = new Set((s.devices || []).filter((d) => d.status === "disconnected").map((d) => d.id));
      const deviceAlerts = [
        ...prev.deviceAlerts.filter((a) => a.crossing_id !== s.crossing_id || (stillDown.has(a.id) && !newlyDown.some((n) => n.id === a.id))),
        ...newlyDown,
      ];

      const sig = (x) => (x?.devices || []).map((d) => d.id + d.status).join();
      const changed = !old || old.state !== s.state || old.acknowledged?.at !== s.acknowledged?.at || sig(old) !== sig(s);
      return {
        states: { ...prev.states, [s.crossing_id]: s },
        changeKey: changed ? prev.changeKey + 1 : prev.changeKey,
        deviceAlerts: deviceAlerts.length === prev.deviceAlerts.length && !newlyDown.length ? prev.deviceAlerts : deviceAlerts,
      };
    }),
}));

let socket = null;
let retry = null;
let users = 0;

function connect() {
  const ws = new WebSocket(WS_URL);
  socket = ws;
  ws.onopen = () => useMawFeed.setState({ connected: true });
  ws.onmessage = (e) => {
    try { useMawFeed.getState().receive(JSON.parse(e.data)); } catch { /* ignore malformed frames */ }
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    useMawFeed.setState({ connected: false });
    if (users > 0) retry = setTimeout(connect, 3000);
  };
}

// Reference-counted so the socket lives while any authenticated page is mounted.
export function startMawFeed() {
  users++;
  if (!socket && !retry) connect();
  return () => {
    users--;
    if (users > 0) return;
    clearTimeout(retry);
    retry = null;
    const ws = socket;
    socket = null;
    ws?.close();
  };
}

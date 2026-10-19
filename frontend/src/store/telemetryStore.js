import { create } from 'zustand';

export const useTelemetryStore = create((set) => ({
  sensorReadings: {},
  fusionResults: {},
  nodeHealth: {},
  events: [],
  settings: {
    weights: { v_norm: 0.35, l_norm: 0.3, m_norm: 0.2, s_norm: 0.15 },
    threshold: 0.6,
  },
  isConnected: false,
  lastSync: null,

  addSensorReading: (reading) => set((state) => ({
    sensorReadings: { ...state.sensorReadings, [reading.nodeId]: reading },
  })),

  addFusionResult: (result) => set((state) => ({
    fusionResults: { ...state.fusionResults, [result.nodeId]: result },
  })),

  updateNodeHealth: (health) => set((state) => ({
    nodeHealth: { ...state.nodeHealth, [health.nodeId]: health },
  })),

  addEvent: (event) => set((state) => ({
    events: [event, ...state.events],
  })),

  setSettings: (settings) => set((state) => ({
    settings: { ...state.settings, ...settings },
  })),

  connect: () => set({ isConnected: true, lastSync: new Date().toISOString() }),
  disconnect: () => set({ isConnected: false, lastSync: null }),
  updateLastSync: () => set({ lastSync: new Date().toISOString() }),
}));

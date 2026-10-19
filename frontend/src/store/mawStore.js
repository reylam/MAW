import { create } from 'zustand';

export const useMawStore = create((set) => ({
  // Global State
  activeCrossing: null,
  alerts: [],
  systemHealth: 'operational',
  isDarkMode: false,

  // Actions
  setActiveCrossing: (crossing) => set({ activeCrossing: crossing }),
  addAlert: (alert) => set((state) => ({ alerts: [...state.alerts, alert] })),
  setSystemHealth: (health) => set({ systemHealth: health }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
}));

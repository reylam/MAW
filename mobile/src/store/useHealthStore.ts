import { create } from 'zustand';
import { apiGet } from '@/services/api';

type HealthState = {
  status: 'idle' | 'loading' | 'ok' | 'error';
  error?: string;
  check: () => Promise<void>;
};

export const useHealthStore = create<HealthState>((set) => ({
  status: 'idle',
  check: async () => {
    set({ status: 'loading', error: undefined });
    try {
      await apiGet('/health');
      set({ status: 'ok' });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },
}));

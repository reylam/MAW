import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { apiPost } from '@/services/api';
import type { Operator } from '@/types/maw';

const KEY = 'maw.operator';

type AuthStore = {
  operator: Operator | null;
  ready: boolean;
  restore: () => Promise<void>;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  operator: null,
  ready: false,
  restore: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ operator: raw ? (JSON.parse(raw) as Operator) : null, ready: true });
    } catch {
      set({ ready: true });
    }
  },
  login: async (email) => {
    const operator = await apiPost<Operator>('/auth/validate-operator', { email: email.trim() });
    await AsyncStorage.setItem(KEY, JSON.stringify(operator)).catch(() => {});
    set({ operator });
  },
  logout: async () => {
    await AsyncStorage.removeItem(KEY).catch(() => {});
    set({ operator: null });
  },
}));

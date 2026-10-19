import { create } from 'zustand';
import type { CrossingState } from '@/types/maw';

export type Connection = 'connecting' | 'open' | 'closed';
export type Sample = { t: number; score: number };

const SPARKLINE_MS = 120_000;

type MawStore = {
  connection: Connection;
  // Local clock correction: server time minus phone time (DESIGN.md 8.6).
  clockOffsetMs: number;
  crossings: Record<string, CrossingState>;
  samples: Record<string, Sample[]>;
  setConnection: (c: Connection) => void;
  upsert: (s: CrossingState) => void;
};

export const useMawStore = create<MawStore>((set) => ({
  connection: 'connecting',
  clockOffsetMs: 0,
  crossings: {},
  samples: {},
  setConnection: (connection) => set({ connection }),
  upsert: (s) =>
    set((prev) => {
      const offset = new Date(s.server_ts).getTime() - Date.now();
      const list = prev.samples[s.crossing_id] ?? [];
      let samples = list;
      if (s.received_at && s.fusion_score != null) {
        const t = new Date(s.received_at).getTime();
        if (!list.length || list[list.length - 1].t !== t) {
          samples = [...list, { t, score: s.fusion_score }].filter((p) => t - p.t <= SPARKLINE_MS);
        }
      }
      return {
        clockOffsetMs: offset,
        crossings: { ...prev.crossings, [s.crossing_id]: s },
        samples: samples === list ? prev.samples : { ...prev.samples, [s.crossing_id]: samples },
      };
    }),
}));

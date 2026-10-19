import { useColorScheme } from 'react-native';
import type { MawState } from '@/types/maw';

/*
  Design tokens (DESIGN.md 7). Status colors are shifted from the original
  values so text on the instruction card reaches 7:1 contrast (WCAG AAA):
  light mode uses white text on darker fills, dark mode uses dark text on
  brighter fills.
*/

const light = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  border: '#E3E6EA',
  text: '#111418',
  textMuted: '#5B6470',
  safe: '#0B5E30',
  standby: '#7A4900',
  danger: '#A3121A',
  unknown: '#3A3F47',
  onStatus: '#FFFFFF',
  // Zone colors for bars on a neutral surface (not under text).
  zoneSafe: '#0F7B3F',
  zoneStandby: '#B26A00',
  zoneDanger: '#C4161C',
};

const dark: typeof light = {
  bg: '#0E1116',
  surface: '#171B22',
  border: '#262C35',
  text: '#F2F4F7',
  textMuted: '#9AA3AE',
  safe: '#2FBF71',
  standby: '#F2A93B',
  danger: '#FF8A8C',
  unknown: '#9AA3AE',
  onStatus: '#0E1116',
  zoneSafe: '#2FBF71',
  zoneStandby: '#F2A93B',
  zoneDanger: '#FF4D4F',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark; // default dark for night shifts
}

export function statusColor(theme: Theme, state: MawState): string {
  switch (state) {
    case 'AMAN': return theme.safe;
    case 'SIAGA': return theme.standby;
    case 'TUTUP':
    case 'MENUNGGU_AMAN': return theme.danger;
    default: return theme.unknown;
  }
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { card: 16, button: 12 };

export const type = {
  phone: { title: 40, subtitle: 18, score: 36, body: 15, meta: 12 },
  tablet: { title: 64, subtitle: 22, score: 48, body: 16, meta: 13 },
};

import { useColorScheme } from 'react-native';
import type { MawState } from '@/types/maw';

/*
  Mirrors the web design system (frontend/src/styles/tokens.css): neutral
  surfaces, brand blue, IBM Plex + Space Grotesk, 8px radius, soft status
  chips. The only addition is `fill*`: darker/lighter versions of the web
  status hues used as the full background of the instruction card, so text
  on it reaches 7:1 contrast (DESIGN.md 7.1).
*/

const light = {
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  hover: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  borderSubtle: '#EEF2F6',

  primary: '#005AA9',
  primarySoft: '#E8F0F8',
  accent: '#F58220',

  safe: '#0F8A5F',
  safeSoft: '#E6F4EE',
  safeBorder: '#B7E0CE',
  warning: '#B45309',
  warningSoft: '#FBF0E0',
  warningBorder: '#F0D49E',
  critical: '#C62828',
  criticalSoft: '#FBE9E9',
  criticalBorder: '#F2BFBF',
  offline: '#64748B',
  offlineSoft: '#EEF1F5',
  offlineBorder: '#D5DCE4',

  text: '#0F172A',
  textMuted: '#475569',
  textSubtle: '#7A8699',

  fillSafe: '#0B5E3F',
  fillWarning: '#843C06',
  fillCritical: '#9F1E1E',
  fillOffline: '#475569',
  onFill: '#FFFFFF',

  dark: false,
};

const dark: typeof light = {
  bg: '#0B1220',
  surface: '#141C2B',
  hover: '#1E293B',
  border: '#273243',
  borderStrong: '#3A4759',
  borderSubtle: '#1C2535',

  primary: '#3B82F6',
  primarySoft: '#16263E',
  accent: '#F97316',

  safe: '#34D399',
  safeSoft: '#11271F',
  safeBorder: '#1E4435',
  warning: '#FBBF24',
  warningSoft: '#2A1F0C',
  warningBorder: '#4A3717',
  critical: '#F87171',
  criticalSoft: '#2A1414',
  criticalBorder: '#4A2222',
  offline: '#94A3B8',
  offlineSoft: '#1C2535',
  offlineBorder: '#2E3B4E',

  text: '#F1F5F9',
  textMuted: '#B6C2D2',
  textSubtle: '#8595A8',

  fillSafe: '#34D399',
  fillWarning: '#FBBF24',
  fillCritical: '#F99B9B',
  fillOffline: '#94A3B8',
  onFill: '#0B1220',

  dark: true,
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark; // default dark for night shifts
}

export type Tone = 'safe' | 'warning' | 'critical' | 'offline';

export function toneOf(state: MawState): Tone {
  switch (state) {
    case 'AMAN': return 'safe';
    case 'SIAGA': return 'warning';
    case 'TUTUP':
    case 'MENUNGGU_AMAN': return 'critical';
    default: return 'offline';
  }
}

export function toneColors(theme: Theme, tone: Tone) {
  return {
    fg: theme[tone],
    soft: theme[`${tone}Soft` as const],
    border: theme[`${tone}Border` as const],
  };
}

export function fillColor(theme: Theme, state: MawState): string {
  const tone = toneOf(state);
  return { safe: theme.fillSafe, warning: theme.fillWarning, critical: theme.fillCritical, offline: theme.fillOffline }[tone];
}

// Same font roles as the web: Plex Sans body, Space Grotesk display, Plex Mono numbers/eyebrows.
export const font = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemi: 'IBMPlexSans_600SemiBold',
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };
export const radius = { sm: 6, md: 8, lg: 10, card: 10 };

export const type = {
  phone: { title: 34, subtitle: 16, score: 36, body: 15, meta: 12 },
  tablet: { title: 56, subtitle: 20, score: 48, body: 16, meta: 13 },
};

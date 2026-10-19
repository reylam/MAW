// Indonesian formatting (DESIGN.md 11): comma decimals, 24h clock.

export function decimal(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return value.toFixed(digits).replace('.', ',');
}

const pad = (n: number) => String(n).padStart(2, '0');

export function clock(iso: string | number | Date, withSeconds = false): string {
  const d = new Date(iso);
  return withSeconds ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function duration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${pad(s)}s` : `${s} dtk`;
}

export const STATE_LABEL = {
  AMAN: 'AMAN',
  SIAGA: 'SIAGA',
  TUTUP: 'TUTUP',
  MENUNGGU_AMAN: 'MENUNGGU AMAN',
  CEK_MANUAL: 'CEK MANUAL',
} as const;

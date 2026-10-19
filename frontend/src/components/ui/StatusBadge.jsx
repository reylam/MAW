import { ShieldCheck, AlertTriangle, OctagonAlert, WifiOff, CircleDot } from 'lucide-react';

/*
  Single source of truth for how a crossing / device state is presented.
  Never relies on colour alone — every status carries an icon and a label.
*/
export const STATUS_META = {
  safe: {
    label: 'Safe',
    icon: ShieldCheck,
    fg: 'text-maw-safe',
    soft: 'bg-maw-safe-soft',
    border: 'border-maw-safe-border',
    dot: 'bg-maw-safe',
  },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
    fg: 'text-maw-warning',
    soft: 'bg-maw-warning-soft',
    border: 'border-maw-warning-border',
    dot: 'bg-maw-warning',
  },
  critical: {
    label: 'Critical',
    icon: OctagonAlert,
    fg: 'text-maw-critical',
    soft: 'bg-maw-critical-soft',
    border: 'border-maw-critical-border',
    dot: 'bg-maw-critical',
  },
  offline: {
    label: 'Offline',
    icon: WifiOff,
    fg: 'text-maw-offline',
    soft: 'bg-maw-offline-soft',
    border: 'border-maw-offline-border',
    dot: 'bg-maw-offline',
  },
};

export function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.offline;
}

/**
 * Compact status badge: dot + label on a soft tinted chip.
 * `size`: 'sm' | 'md'
 */
export default function StatusBadge({ status, label, size = 'sm', showIcon = false, className = '' }) {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;
  const text = label || meta.label;
  const pad = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';
  const alert = status === 'critical' ? 'animate-maw-alert' : '';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-maw-sm border font-semibold ${pad} ${meta.soft} ${meta.border} ${meta.fg} ${className}`}
    >
      {showIcon ? (
        <Icon size={size === 'md' ? 14 : 12} />
      ) : (
        <span className={`status-dot ${meta.dot} ${alert}`} />
      )}
      <span className="uppercase tracking-wide">{text}</span>
    </span>
  );
}

export { CircleDot };

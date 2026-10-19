/*
  Metric cell. Values use the display face at a controlled size — big enough
  to scan, not so big it turns an operations screen into a marketing page.
  `tone` tints only the number, not the whole card.
*/
const TONES = {
  default: 'text-maw-text-main',
  primary: 'text-maw-primary',
  safe: 'text-maw-safe',
  warning: 'text-maw-warning',
  critical: 'text-maw-critical',
  muted: 'text-maw-text-subtle',
};

export default function StatCell({ label, value, suffix, tone = 'default', hint }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl sm:text-[26px] leading-none font-display font-bold ${TONES[tone] || TONES.default}`}>
          {value}
        </span>
        {suffix && <span className="text-sm text-maw-text-subtle font-medium">{suffix}</span>}
      </div>
      <div className="mt-1.5 text-[11px] uppercase tracking-wider text-maw-text-subtle">{label}</div>
      {hint && <div className="text-xs text-maw-text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

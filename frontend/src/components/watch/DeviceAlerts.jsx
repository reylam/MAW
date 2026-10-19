import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { OctagonAlert, WifiOff, X } from 'lucide-react';
import { useMawFeed } from '../../store/mawFeedStore';

/*
  Device disconnect warnings, shown on every authenticated page:
  - a pop-up the moment a registered device (ESP32 / MPU6500 / HX711 / HMC5883L /
    MAX9814) drops, until the operator dismisses it
  - a banner that stays while any device is still disconnected
  A disconnected device puts its crossing in MANUAL CHECK (fail-safe), so the
  pop-up says so.
*/

export default function DeviceAlerts() {
  const alerts = useMawFeed((s) => s.deviceAlerts);
  const dismiss = useMawFeed((s) => s.dismissDeviceAlerts);
  const states = useMawFeed((s) => s.states);

  const down = Object.values(states).flatMap((c) =>
    (c.devices || []).filter((d) => d.status === 'disconnected').map((d) => ({ ...d, crossing_name: c.crossing_name })),
  );

  useEffect(() => {
    if (!alerts.length) return;
    const onKey = (e) => e.key === 'Escape' && dismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alerts.length, dismiss]);

  const crossingNames = [...new Set(alerts.map((a) => a.crossing_name))].join(', ');

  return (
    <>
      {down.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-maw-critical-soft border-b border-maw-critical-border px-4 sm:px-6 py-2.5">
          <WifiOff size={16} className="text-maw-critical shrink-0 animate-maw-alert" />
          <span className="text-sm font-semibold text-maw-critical">
            {down.length} device{down.length > 1 ? 's' : ''} disconnected
          </span>
          <span className="text-sm text-maw-text-muted truncate">
            {down.map((d) => d.name).join(', ')} · crossing in manual check, do not rely on automatic detection
          </span>
          <Link to="/health" className="ml-auto text-xs font-semibold text-maw-critical hover:underline shrink-0">Device health</Link>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/60 flex items-center justify-center p-4" onClick={dismiss}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="device-alert-title"
            className="w-full max-w-md bg-maw-card border border-maw-critical-border rounded-maw-lg shadow-xl overflow-hidden maw-frame-flash"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 bg-maw-critical text-white px-5 py-4">
              <OctagonAlert size={26} className="shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] opacity-85">Device alert</div>
                <h2 id="device-alert-title" className="font-display font-bold text-lg leading-snug">
                  {alerts.length === 1 ? `${alerts[0].name} disconnected` : `${alerts.length} devices disconnected`}
                </h2>
              </div>
              <button onClick={dismiss} aria-label="Dismiss" className="p-1 -m-1 rounded hover:bg-white/15"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <ul className="space-y-1.5">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm text-maw-text-main">
                    <span className="status-dot bg-maw-critical animate-maw-alert" />
                    <span className="font-semibold">{a.name}</span>
                    <span className="text-maw-text-subtle text-xs">{a.crossing_name}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-maw-text-muted">
                Sensor data from {crossingNames} can no longer be trusted. The barrier instruction is now <span className="font-semibold text-maw-text-main">MANUAL CHECK</span>: follow the manual SOP until the device is connected again.
              </p>
              <div className="flex gap-2 pt-1">
                <Link
                  to="/health"
                  onClick={dismiss}
                  className="flex-1 text-center py-2.5 rounded-maw bg-maw-primary hover:bg-maw-primary-hover text-white text-sm font-semibold transition-colors"
                >
                  Open device health
                </Link>
                <button onClick={dismiss} className="px-4 py-2.5 rounded-maw border border-maw-border text-sm font-semibold text-maw-text-main hover:bg-maw-hover transition-colors">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

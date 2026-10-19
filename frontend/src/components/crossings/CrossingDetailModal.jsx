import { useEffect } from 'react';
import { X, MapPin } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { NODE_SENSORS } from '../../lib/adapters';

export default function CrossingDetailModal({ crossing, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Normalized values (0-1) from the sensor node; a sensor without a value is not reading.
  const sensors = NODE_SENSORS.map((s) => {
    const v = crossing.sensors[s.field];
    return { name: s.hw, type: s.label, val: v != null ? v.toFixed(2) : 'No data', status: v != null ? 'online' : 'offline' };
  });

  const metrics = [
    { label: 'Train detection', value: crossing.trainDetected ? 'DETECTED' : 'CLEAR', danger: crossing.trainDetected },
    { label: 'Barrier gate', value: String(crossing.barrierStatus).toUpperCase(), danger: false },
    { label: 'Obstacle alarm', value: crossing.obstacleDetected ? 'DETECTED' : 'NONE', danger: crossing.obstacleDetected },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${crossing.name} details`}
    >
      <div
        className="bg-maw-card rounded-maw-lg border border-maw-border w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-maw"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-maw-card px-5 sm:px-6 py-4 border-b border-maw-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-maw-text-subtle font-mono">{crossing.id}</span>
              <StatusBadge status={crossing.status} showIcon />
            </div>
            <h2 className="text-lg font-display font-bold text-maw-text-main mt-0.5 truncate">{crossing.name}</h2>
            <div className="text-xs text-maw-text-subtle flex items-center gap-1">
              <MapPin size={11} /> {crossing.location}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-maw-text-subtle hover:text-maw-text-main rounded-maw-sm hover:bg-maw-hover transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="bg-maw-hover rounded-maw-sm border border-maw-border-subtle p-4">
                <div className="text-[11px] uppercase tracking-wider text-maw-text-subtle">{m.label}</div>
                <div className={`text-base font-mono font-bold mt-1 ${m.danger ? 'text-maw-critical' : 'text-maw-text-main'}`}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="eyebrow mb-3">Sensor node telemetry</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sensors.map((sensor) => (
                <div
                  key={sensor.name}
                  className="bg-maw-hover rounded-maw-sm border border-maw-border-subtle p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-maw-text-main truncate">{sensor.name}</div>
                    <div className="text-xs text-maw-text-subtle">{sensor.type}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono text-maw-text-main font-semibold">{sensor.val}</div>
                    <div className={`text-[10px] font-mono uppercase ${sensor.status === 'connected' || sensor.status === 'online' ? 'text-maw-safe' : 'text-maw-offline'}`}>
                      {sensor.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

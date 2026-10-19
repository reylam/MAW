import { useCallback, useEffect, useState } from 'react';
import { SlidersHorizontal, Gauge, Timer } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { ApiErrorState, LoadingState } from '../components/ui/States';
import { mawService } from '../services/mawService';

// Detection parameters live in the backend config (MAW_* env, see backend/.env.example)
// so every client and the ESP32 firmware use the same values. This page only displays them.

const SENSORS = [
  { field: 'v_norm', label: 'Vibration', hw: 'MPU6500' },
  { field: 'l_norm', label: 'Load', hw: 'Load Cell HX711' },
  { field: 'm_norm', label: 'Magnetic', hw: 'HMC5883L' },
  { field: 's_norm', label: 'Acoustic', hw: 'MAX9814' },
];

function Row({ label, sub, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-maw-border-subtle last:border-0">
      <div className="min-w-0">
        <div className="text-sm text-maw-text-main font-medium">{label}</div>
        {sub && <div className="text-xs text-maw-text-subtle">{sub}</div>}
      </div>
      <span className="font-mono text-sm font-semibold text-maw-primary bg-maw-primary-soft px-2.5 py-0.5 rounded-maw-sm">{value}</span>
    </div>
  );
}

export default function Settings() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    mawService.getConfig().then((res) => setConfig(res.data)).catch(setError);
  }, []);
  useEffect(() => { load(); }, [load]);

  const total = config ? SENSORS.reduce((a, s) => a + config.weights[s.field], 0) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Configuration"
        title="Detection settings"
        description="Sensor fusion parameters currently enforced by the backend. Change them via MAW_* variables in backend/.env; T_TUTUP must match the ESP32 firmware threshold."
      />

      {error ? (
        <Card><ApiErrorState error={error} onRetry={load} /></Card>
      ) : !config ? (
        <Card><LoadingState label="Loading configuration…" /></Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Sensor weights" eyebrow="Fusion Score = Σ weight × normalized value" icon={SlidersHorizontal} />
            <div className="px-5 sm:px-6 pb-2">
              {SENSORS.map((s) => (
                <Row key={s.field} label={s.label} sub={`${s.hw} · ${s.field}`} value={config.weights[s.field].toFixed(2)} />
              ))}
              <Row label="Total" value={`${total.toFixed(2)} / 1.00 ${Math.abs(total - 1) < 0.001 ? '✓' : '✗'}`} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Thresholds" eyebrow="Barrier instruction" icon={Gauge} />
            <div className="px-5 sm:px-6 pb-2">
              <Row label="Close threshold (T_TUTUP)" sub="Score at or above: close the barrier" value={config.T_TUTUP.toFixed(2)} />
              <Row label="Standby / release threshold (T_SIAGA)" sub="Score must fall below this before opening" value={config.T_SIAGA.toFixed(2)} />
              <Row label="Score tolerance (SCORE_TOL)" sub="Allowed node vs recomputed difference" value={config.SCORE_TOL.toFixed(2)} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Timing" eyebrow="Fail-safe" icon={Timer} />
            <div className="px-5 sm:px-6 pb-2">
              <Row label="Safe hold (HOLD_BUKA)" sub="Score must stay low this long before OPEN" value={`${config.HOLD_BUKA_S} s`} />
              <Row label="Stale data limit (STALE_MAX)" sub="No data this long: manual check" value={`${config.STALE_MAX_S} s`} />
              <Row label="Node heartbeat" sub="Expected publish interval from each sensor node" value={`${config.HEARTBEAT_S} s`} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

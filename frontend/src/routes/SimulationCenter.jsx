import { useCallback, useEffect, useState } from 'react';
import { Play, Square, Train, ShieldCheck, AlertTriangle, OctagonAlert, FlaskConical, Terminal } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { ApiErrorState, EmptyState, LoadingState } from '../components/ui/States';
import BarrierInstruction from '../components/maw/BarrierInstruction';
import apiClient from '../services/apiClient';
import { useMawFeed } from '../store/mawFeedStore';
import { useAuthStore } from '../store/authStore';

/*
  Runs a scenario on the backend: the payload (backend/scripts/scenarios.json)
  is fed into the MAW engine every heartbeat, exactly like a sensor node, so
  the web dashboard and the petugas app react for real. Same scenarios as
  `npm run s3 / s4 / s5 / train` in backend/.
*/

const STATUS_META = {
  SAFE: { icon: ShieldCheck, cls: 'text-maw-safe', expect: 'Barrier may open (AMAN)' },
  WARNING: { icon: AlertTriangle, cls: 'text-maw-warning', expect: 'Prepare to close (SIAGA)' },
  DANGER: { icon: OctagonAlert, cls: 'text-maw-critical', expect: 'Close barrier now (TUTUP), alarm on petugas app' },
};

export default function SimulationCenter() {
  const [scenarios, setScenarios] = useState(null);
  const [error, setError] = useState(null);
  const [disabled, setDisabled] = useState(false); // simulation is turned off on this server
  const [runError, setRunError] = useState(null);
  const [busy, setBusy] = useState(null);
  const operator = useAuthStore((s) => s.operator);
  const sim = useMawFeed((s) => s.sim);
  const crossingId = useMawFeed((s) => Object.keys(s.states)[0]);

  const load = useCallback(() => {
    setError(null);
    apiClient
      .request('/maw/sim')
      .then((res) => setScenarios(res.data.scenarios))
      .catch((err) => (err.message === 'Route not found' ? setDisabled(true) : setError(err)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (path, body) => {
    setBusy(body?.scenario ?? 'stop');
    setRunError(null);
    try {
      // The operator identifies the requester: a public server only lets a supervisor run simulations.
      await apiClient.request(path, { method: 'POST', body: JSON.stringify({ ...(body ?? {}), operator }) });
    } catch (err) {
      setRunError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Testing"
        title="Simulation center"
        description="Feed sensor node scenarios into the backend without hardware. The dashboard and the petugas app respond exactly as they would to the real node."
      />

      {sim.running && (
        <div className="flex items-center justify-between gap-3 rounded-maw border border-maw-accent-border bg-maw-accent-soft border-l-2 border-l-maw-accent px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FlaskConical className="text-maw-accent animate-maw-alert shrink-0" size={18} />
            <div className="min-w-0">
              <div className="text-xs font-bold text-maw-accent uppercase tracking-wide">Simulation running</div>
              <div className="text-xs text-maw-text-muted truncate">{sim.label} · since {new Date(sim.started_at).toLocaleTimeString('id-ID')}</div>
            </div>
          </div>
          <button
            onClick={() => run('/maw/sim/stop')}
            disabled={busy === 'stop'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-maw-surface border border-maw-border rounded-maw-sm text-xs font-semibold text-maw-text-main hover:bg-maw-hover transition-colors shrink-0 disabled:opacity-60"
          >
            <Square size={12} /> Stop
          </button>
        </div>
      )}

      {runError && (
        <div role="alert" className="rounded-maw border border-maw-critical-border bg-maw-critical-soft px-4 py-3 text-sm text-maw-critical">
          {runError}
        </div>
      )}

      <Card>
        <CardHeader title="Scenarios" eyebrow="Sent every 5 s until stopped" icon={Play} />
        {disabled ? (
          <EmptyState
            icon={FlaskConical}
            title="Simulation is disabled on this server"
            description="It is off in production by default. Set MAW_ENABLE_SIM=true on the backend to allow supervisors to use it."
          />
        ) : error ? (
          <ApiErrorState error={error} onRetry={load} />
        ) : !scenarios ? (
          <LoadingState label="Loading scenarios…" />
        ) : (
          <div className="divide-y divide-maw-border-subtle">
            {scenarios.map((s) => {
              const meta = STATUS_META[s.status];
              const Icon = s.id === 'train' ? Train : meta?.icon ?? Play;
              const active = sim.running && sim.scenario === s.id;
              return (
                <div key={s.id} className={`flex items-center gap-3 px-4 sm:px-5 py-3.5 ${active ? 'bg-maw-primary-soft' : ''}`}>
                  <Icon size={20} className={s.id === 'train' ? 'text-maw-primary' : meta?.cls ?? 'text-maw-text-subtle'} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-maw-text-main">{s.label}</div>
                    <div className="text-xs text-maw-text-muted">
                      {s.id === 'train'
                        ? 'Score rises and falls like a passing train, then returns to safe.'
                        : `status ${s.status} · fusion ${s.fusion_score?.toFixed(2)} · expected: ${meta?.expect ?? '-'}`}
                    </div>
                  </div>
                  {active ? (
                    <span className="text-xs font-semibold text-maw-primary uppercase tracking-wide">Running</span>
                  ) : (
                    <button
                      onClick={() => run('/maw/sim/start', { scenario: s.id })}
                      disabled={busy != null}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-maw-primary hover:bg-maw-primary-hover text-white rounded-maw-sm text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                      <Play size={12} /> {sim.running ? 'Switch' : 'Run'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {crossingId && <BarrierInstruction crossingId={crossingId} />}

      <Card>
        <CardHeader title="Through MQTT instead" eyebrow="Command line" icon={Terminal} />
        <div className="p-4 sm:p-5 text-sm text-maw-text-muted space-y-2">
          <p>To test the full broker path, publish the same scenarios to the MQTT topic from <span className="font-mono text-maw-text-main">backend/</span>:</p>
          <pre className="font-mono text-xs bg-maw-hover border border-maw-border-subtle rounded-maw-sm p-3 overflow-x-auto text-maw-text-main">npm run s4   # SAFE{'\n'}npm run s5   # WARNING{'\n'}npm run s3   # DANGER{'\n'}npm run train</pre>
          <p>Add a scenario by pasting a firmware payload into <span className="font-mono text-maw-text-main">backend/scripts/scenarios.json</span>.</p>
        </div>
      </Card>
    </div>
  );
}

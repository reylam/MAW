import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, OctagonAlert, Hourglass, HelpCircle, Check, Volume2, VolumeX, ArrowUpRight, Eye } from 'lucide-react';
import { useMawFeed } from '../../store/mawFeedStore';
import { useAuthStore } from '../../store/authStore';
import { useWebAlarm } from '../../hooks/useWebAlarm';
import apiClient from '../../services/apiClient';
import { NODE_SENSORS } from '../../lib/adapters';
import CrossingScene from './CrossingScene';

/*
  Dashboard "watch" panel: one focused place to supervise a crossing.
  Mirrors the petugas app (same backend state) and adds the animated crossing
  view, the 20 s confirmation countdown and the operator confirmation.
  Fail-safe: with no live feed or stale data it shows MANUAL CHECK.
*/

// Fixed fills (same as the petugas app light theme) so white text keeps 7:1 contrast in both themes.
const META = {
  AMAN: { title: 'BARRIER MAY OPEN', icon: CheckCircle2, fill: 'bg-[#0B5E3F]' },
  SIAGA: { title: 'PREPARE TO CLOSE', icon: AlertTriangle, fill: 'bg-[#843C06]' },
  TUTUP: { title: 'CLOSE BARRIER NOW', icon: OctagonAlert, fill: 'bg-[#9F1E1E]' },
  MENUNGGU_AMAN: { title: 'KEEP BARRIER CLOSED', icon: Hourglass, fill: 'bg-[#9F1E1E]' },
  CEK_MANUAL: { title: 'MANUAL CHECK', icon: HelpCircle, fill: 'bg-[#475569]' },
};

const ZONE = (v, t) => (v >= t.tutup ? 'bg-maw-critical' : v >= t.siaga ? 'bg-maw-warning' : 'bg-maw-safe');

function Countdown({ remaining, total, overdue }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const frac = overdue ? 1 : Math.max(0, Math.min(1, remaining / total));
  return (
    <div className="relative h-24 w-24 shrink-0" aria-label={overdue ? 'Confirmation overdue' : `${remaining} seconds to confirm`}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 0.9s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-mono text-2xl font-bold tabular-nums">{overdue ? `+${remaining}` : remaining}</span>
        <span className="text-[10px] font-mono uppercase tracking-wider opacity-80">{overdue ? 'late' : 'sec'}</span>
      </div>
    </div>
  );
}

export default function CrossingWatch({ crossingId }) {
  const s = useMawFeed((st) => st.states[crossingId]);
  const connected = useMawFeed((st) => st.connected);
  const operator = useAuthStore((st) => st.operator);
  const [busy, setBusy] = useState(false);
  const [ackError, setAckError] = useState(null);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

    const ageS = s?.received_at ? Math.max(0, (now - new Date(s.received_at).getTime()) / 1000) : null;
  const stale = !connected || !s || ageS == null || ageS > s.stale_max_s;
  const state = stale ? 'CEK_MANUAL' : s.state;
  const meta = META[state];
  const Icon = meta.icon;
  const acknowledged = Boolean(s?.acknowledged);
  const needsAck = !stale && (state === 'TUTUP' || state === 'MENUNGGU_AMAN') && !acknowledged;
  const flashing = state === 'TUTUP' && !acknowledged;

  const deadline = s?.close_deadline_at ? new Date(s.close_deadline_at).getTime() : null;
  const left = deadline != null ? Math.ceil((deadline - now) / 1000) : null;
  const overdue = s?.ack_overdue || (left != null && left <= 0);
  const holdLeft = s?.hold_remaining_s != null ? Math.max(0, Math.ceil(s.hold_remaining_s - (now - new Date(s.server_ts).getTime()) / 1000)) : null;

  const { enabled: sound, toggle: toggleSound } = useWebAlarm({ state, acknowledged });

  const confirm = async () => {
    if (!operator) return;
    setBusy(true);
    setAckError(null);
    try {
      const res = await apiClient.request(`/crossings/${crossingId}/ack`, { method: 'POST', body: JSON.stringify({ operator }) });
      useMawFeed.getState().receive({ event: 'crossing.state', data: res.data });
    } catch (err) {
      setAckError(err.message);
    } finally {
      setBusy(false);
    }
  };

  let detail;
  if (!connected) detail = 'Live feed disconnected. Do not rely on this screen, follow the manual SOP.';
  else if (!s) detail = 'Waiting for the first message from the sensor node.';
  else if (state === 'CEK_MANUAL') detail = `${s.cause || 'No fresh data from the sensor node'}. Follow the manual SOP.`;
  else if (state === 'AMAN') detail = 'No train detected. Make sure the track is visually clear.';
  else if (state === 'SIAGA') detail = `Train signal rising (score ${s.fusion_score_effective?.toFixed(2)}). Get ready to close.`;
  else if (state === 'TUTUP') detail = 'Train approaching. The guard must close the barrier now.';
  else detail = `Train leaving. Barrier may open in ${holdLeft ?? '-'} s.`;

  const t = s?.thresholds ?? { siaga: 0.4, tutup: 0.6 };
  const score = s?.fusion_score;

  return (
    <section
      aria-label={`Crossing watch: ${s?.crossing_name ?? crossingId}`}
      className={`rounded-maw border border-maw-border bg-maw-card shadow-maw-sm overflow-hidden ${flashing ? 'maw-frame-flash' : ''}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3 border-b border-maw-border-subtle">
        <Eye size={16} className="text-maw-text-subtle" />
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Crossing watch · {s?.node.node_id ?? 'no node'}</div>
          <h2 className="font-display font-semibold text-maw-text-main truncate">{s?.crossing_name ?? crossingId}</h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${stale ? 'text-maw-critical' : ageS > 5 ? 'text-maw-warning' : 'text-maw-safe'}`}>
          <span className={`status-dot ${stale ? 'bg-maw-critical animate-maw-alert' : ageS > 5 ? 'bg-maw-warning' : 'bg-maw-safe'}`} />
          {stale ? 'NO DATA' : ageS > 5 ? 'DELAYED' : 'LIVE'}{ageS != null ? ` · ${Math.floor(ageS)}s ago` : ''}
        </span>
        <button
          onClick={toggleSound}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-maw-sm border text-xs font-semibold transition-colors ${sound ? 'border-maw-primary text-maw-primary bg-maw-primary-soft' : 'border-maw-border text-maw-text-muted hover:text-maw-text-main'}`}
          aria-pressed={sound}
        >
          {sound ? <Volume2 size={14} /> : <VolumeX size={14} />} {sound ? 'Alarm on' : 'Enable alarm'}
        </button>
        <Link to={`/crossing/${crossingId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-maw-primary hover:text-maw-primary-hover">
          Details <ArrowUpRight size={13} />
        </Link>
      </div>

      {/* Registered devices: connected / disconnected (updated over MQTT). */}
      {s?.devices?.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-2.5 border-b border-maw-border-subtle bg-maw-hover/40">
          <span className="eyebrow mr-1">Devices</span>
          {s.devices.map((d) => {
            const up = d.status !== 'disconnected';
            return (
              <span
                key={d.id}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-maw-sm border text-[11px] font-semibold ${up ? 'bg-maw-safe-soft border-maw-safe-border text-maw-safe' : 'bg-maw-critical-soft border-maw-critical-border text-maw-critical'}`}
              >
                <span className={`status-dot ${up ? 'bg-maw-safe' : 'bg-maw-critical animate-maw-alert'}`} />
                {d.name} <span className="font-mono uppercase opacity-80">{up ? 'connected' : 'disconnected'}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="grid lg:grid-cols-[1.25fr_1fr]">
        {/* Animated crossing */}
        <div className="bg-[#0B1220] p-3 sm:p-4 flex flex-col gap-2">
          <div className="aspect-[640/240] w-full">
            <CrossingScene state={state} barrier={s?.barrier_status ?? 'open'} fault={s?.device_faults?.length ? s.device_faults.join(', ') : null} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
            <span>Barrier: <span className={s?.barrier_status === 'closed' ? 'text-red-300' : 'text-emerald-300'}>{(s?.barrier_status ?? 'open').toUpperCase()}</span></span>
            {s?.acknowledged && <span>Confirmed by {s.acknowledged.by} at {new Date(s.acknowledged.at).toLocaleTimeString('id-ID')}{s.acknowledged.took_s != null ? ` (${s.acknowledged.took_s}s)` : ''}</span>}
          </div>
        </div>

        {/* Instruction + action */}
        <div className="flex flex-col">
          <div className={`relative ${meta.fill} text-white p-5 flex-1 flex flex-col gap-4 ${state === 'CEK_MANUAL' ? 'bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0_10px,transparent_10px_20px)]' : ''}`}>
            <div className="flex items-start gap-4">
              <Icon size={40} className={`shrink-0 ${flashing ? 'animate-maw-alert' : ''}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] opacity-80">Barrier instruction</div>
                <div className="font-display font-bold text-2xl sm:text-3xl leading-tight">{meta.title}</div>
                <p className="text-sm mt-1 opacity-95">{detail}</p>
              </div>
              {needsAck && left != null && <Countdown remaining={Math.abs(left)} total={s.close_deadline_s} overdue={overdue} />}
              {state === 'MENUNGGU_AMAN' && acknowledged && holdLeft != null && (
                <Countdown remaining={holdLeft} total={s.hold_buka_s} overdue={false} />
              )}
            </div>

            {needsAck && (
              <div className="space-y-2">
                {overdue && (
                  <div className="text-xs font-semibold uppercase tracking-wide animate-maw-alert">
                    Confirmation overdue, escalated to the alert center
                  </div>
                )}
                <button
                  onClick={confirm}
                  disabled={busy || !operator}
                  className="w-full min-h-[52px] rounded-maw bg-white text-[#9F1E1E] font-semibold text-base flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-70"
                >
                  <Check size={20} strokeWidth={2.6} /> {busy ? 'Confirming…' : 'Confirm barrier closed'}
                </button>
                {ackError && <div className="text-xs">Could not confirm: {ackError}</div>}
                <div className="text-[11px] opacity-80">Confirming as {operator?.name ?? '-'}. There is no remote "open barrier" here: it opens once the system reports safe.</div>
              </div>
            )}
          </div>

          {/* Score + sensors */}
          <div className="p-4 sm:p-5 space-y-3 border-t border-maw-border-subtle">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Fusion score</span>
              <span className="font-mono text-xl font-bold text-maw-text-main tabular-nums">
                {score != null ? score.toFixed(2) : '-'}
                {s?.score_mismatch && <span className="ml-2 text-xs text-maw-warning">node {s.fusion_score_node?.toFixed(2)}</span>}
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-maw-hover border border-maw-border overflow-hidden">
              {score != null && <div className={`h-full ${ZONE(score, t)} transition-all duration-500`} style={{ width: `${Math.min(100, score * 100)}%` }} />}
              <span className="absolute top-0 bottom-0 w-0.5 bg-maw-text-muted" style={{ left: `${t.siaga * 100}%` }} />
              <span className="absolute top-0 bottom-0 w-0.5 bg-maw-text-muted" style={{ left: `${t.tutup * 100}%` }} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {NODE_SENSORS.map((sn) => {
                const c = s?.contributions?.find((x) => x.field === sn.field);
                return (
                  <div key={sn.field} className="min-w-0">
                    <div className="text-[11px] text-maw-text-subtle truncate">{sn.label}</div>
                    <div className="font-mono text-sm font-semibold text-maw-text-main">{c?.value != null ? c.value.toFixed(2) : '-'}</div>
                    <div className="h-1 rounded-full bg-maw-hover overflow-hidden mt-1">
                      <div className="h-full bg-maw-primary" style={{ width: `${(c?.value ?? 0) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

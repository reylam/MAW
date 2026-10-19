import { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { Card, CardHeader } from '../ui/Card';
import { ApiErrorState, EmptyState, LoadingState } from '../ui/States';
import StatusBadge from '../ui/StatusBadge';
import { Activity, Cpu } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useMawFeed } from '../../store/mawFeedStore';
import { NODE_SENSORS } from '../../lib/adapters';

/*
  Real sensor node data (mqx/node/data -> node_readings): Fusion Score and the
  four normalized sensor values. History comes from the API; new messages are
  appended live from the WebSocket feed.
*/

const TIME_RANGES = [
  { label: '15M', minutes: 15 },
  { label: '1H', minutes: 60 },
  { label: '6H', minutes: 360 },
  { label: '24H', minutes: 1440 },
];

const NODE_STATUS_TONE = { SAFE: 'safe', WARNING: 'warning', DANGER: 'critical' };

function toPoint(r) {
  return {
    t: new Date(r.received_at).getTime(),
    fusion: r.score_calc,
    ...Object.fromEntries(NODE_SENSORS.map((s) => [s.field, r.normalisasi?.[s.field] ?? null])),
    raw: r.data_mentah ?? null,
    status: r.status ?? null,
    node_id: r.node_id,
  };
}

export default function Telemetry({ crossingId, crossing }) {
  const [minutes, setMinutes] = useState(60);
  const [points, setPoints] = useState([]);
  const [selected, setSelected] = useState('fusion');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const live = useMawFeed((s) => s.states[crossingId]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    apiClient
      .request(`/crossings/${crossingId}/readings?minutes=${minutes}`)
      .then((res) => { if (active) setPoints((res.data || []).map(toPoint)); })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [crossingId, minutes, reloadKey]);

  // Append each new node message from the live feed.
  useEffect(() => {
    if (!live?.received_at) return;
    const t = new Date(live.received_at).getTime();
    setPoints((prev) => {
      if (prev.length && prev[prev.length - 1].t >= t) return prev;
      const point = {
        t,
        fusion: live.fusion_score,
        ...Object.fromEntries((live.contributions || []).map((c) => [c.field, c.value])),
        raw: null,
        status: live.node.status,
        node_id: live.node.node_id,
      };
      const since = Date.now() - minutes * 60_000;
      return [...prev.filter((p) => p.t >= since), point];
    });
  }, [live?.received_at, live, minutes]);

  const data = useMemo(
    () => points.map((p) => ({ ...p, time: new Date(p.t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: minutes <= 60 ? '2-digit' : undefined }) })),
    [points, minutes],
  );

  const last = points[points.length - 1];
  const lastRaw = [...points].reverse().find((p) => p.raw)?.raw ?? null;
  const thresholds = live?.thresholds ?? { siaga: 0.4, tutup: 0.6 };
  const weights = live?.weights;

  const metrics = [
    { key: 'fusion', label: 'Fusion Score', hw: 'Recomputed by backend' },
    ...NODE_SENSORS.map((s) => ({ key: s.field, label: s.label, color: s.color, hw: s.hw })),
  ];
  const sel = metrics.find((m) => m.key === selected);
  const hasSeries = data.some((p) => p[selected] != null);

  if (error) {
    return <Card><ApiErrorState error={error} onRetry={() => setReloadKey((k) => k + 1)} /></Card>;
  }

  return (
    <div className="space-y-5">
      {/* Current readings - click to chart. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map((m) => {
          const value = last?.[m.key];
          const breach = m.key === 'fusion' && value != null && value >= thresholds.tutup;
          const active = selected === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setSelected(m.key)}
              className={`text-left bg-maw-card rounded-maw border p-4 transition-colors ${active ? 'border-maw-primary' : 'border-maw-border hover:border-maw-border-strong'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-maw-text-muted">{m.label}</span>
                {breach && <span className="status-dot bg-maw-critical animate-maw-alert" />}
              </div>
              <div
                className={`text-2xl font-display font-bold mt-2 ${m.key === 'fusion' ? 'text-maw-text-main' : ''}`}
                style={m.key === 'fusion' ? undefined : { color: m.color }}
              >
                {value != null ? value.toFixed(2) : '-'}
              </div>
              <div className="text-[11px] text-maw-text-subtle mt-1 truncate">{m.hw}</div>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader
          title={`${sel.label} over time`}
          eyebrow={`${crossing?.name || 'Crossing'} · ${points.length} samples`}
          icon={Activity}
          action={
            <div className="flex items-center gap-1">
              {TIME_RANGES.map((r) => (
                <button
                  key={r.minutes}
                  onClick={() => setMinutes(r.minutes)}
                  className={`px-2 py-1 rounded-maw-sm text-[11px] font-mono font-semibold ${minutes === r.minutes ? 'bg-maw-primary text-white' : 'text-maw-text-muted hover:text-maw-text-main'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          }
        />
        <div className="p-4 sm:p-5">
          {isLoading ? (
            <div className="h-72"><LoadingState label="Loading node data…" /></div>
          ) : !hasSeries ? (
            <div className="h-72 flex items-center justify-center">
              <EmptyState icon={Activity} title="No node data in this range" description="Data appears once the sensor node publishes to the MQTT topic." />
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="maw-metric-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={sel.key === 'fusion' ? 'var(--maw-primary)' : sel.color} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={sel.key === 'fusion' ? 'var(--maw-primary)' : sel.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--maw-border)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--maw-text-subtle)" fontSize={10} fontFamily="IBM Plex Mono" tickLine={false} minTickGap={32} />
                  <YAxis domain={[0, 1]} stroke="var(--maw-text-subtle)" fontSize={10} fontFamily="IBM Plex Mono" tickLine={false} axisLine={false} width={44} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--maw-card)', border: '1px solid var(--maw-border)', borderRadius: '8px', color: 'var(--maw-text-main)', fontSize: 12 }}
                    labelStyle={{ color: 'var(--maw-text-subtle)', fontWeight: 600 }}
                    formatter={(v) => [Number(v).toFixed(2), sel.label]}
                  />
                  {sel.key === 'fusion' && (
                    <>
                      <ReferenceLine y={thresholds.siaga} stroke="var(--maw-warning)" strokeDasharray="4 4" label={{ value: 'siaga', fill: 'var(--maw-warning)', fontSize: 10, position: 'insideTopRight' }} />
                      <ReferenceLine y={thresholds.tutup} stroke="var(--maw-critical)" strokeDasharray="4 4" label={{ value: 'tutup', fill: 'var(--maw-critical)', fontSize: 10, position: 'insideTopRight' }} />
                    </>
                  )}
                  <Area type="monotone" dataKey={selected} stroke={sel.key === 'fusion' ? 'var(--maw-primary)' : sel.color} strokeWidth={2} fillOpacity={1} fill="url(#maw-metric-fill)" isAnimationActive={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      {/* Latest node message, for technicians (raw values are not shown to petugas). */}
      <Card>
        <CardHeader
          title="Latest node message"
          eyebrow={last ? `${last.node_id} · ${new Date(last.t).toLocaleTimeString('id-ID')}` : 'Sensor node'}
          icon={Cpu}
          action={last?.status && <StatusBadge status={NODE_STATUS_TONE[last.status] || 'offline'} label={last.status} />}
        />
        {!last ? (
          <EmptyState icon={Cpu} title="No message yet" description="Waiting for the sensor node to publish." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-maw-text-subtle">
                  <th className="px-4 sm:px-5 py-2 font-semibold">Sensor</th>
                  <th className="px-3 py-2 font-semibold text-right">Raw</th>
                  <th className="px-3 py-2 font-semibold text-right">Normalized</th>
                  <th className="px-3 py-2 font-semibold text-right">Weight</th>
                  <th className="px-4 sm:px-5 py-2 font-semibold text-right">Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-maw-border-subtle font-mono">
                {NODE_SENSORS.map((s) => {
                  const v = last[s.field];
                  const w = weights?.[s.field];
                  return (
                    <tr key={s.field}>
                      <td className="px-4 sm:px-5 py-2.5 font-sans">
                        <div className="text-maw-text-main font-medium">{s.label}</div>
                        <div className="text-[11px] text-maw-text-subtle">{s.hw}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-maw-text-muted">{lastRaw?.[s.raw] ?? '-'}</td>
                      <td className="px-3 py-2.5 text-right text-maw-text-main">{v != null ? v.toFixed(2) : 'no data'}</td>
                      <td className="px-3 py-2.5 text-right text-maw-text-muted">{w != null ? w.toFixed(2) : '-'}</td>
                      <td className="px-4 sm:px-5 py-2.5 text-right text-maw-text-main font-semibold">{v != null && w != null ? (v * w).toFixed(3) : '-'}</td>
                    </tr>
                  );
                })}
                <tr className="bg-maw-hover">
                  <td className="px-4 sm:px-5 py-2.5 font-sans font-semibold text-maw-text-main" colSpan={4}>Fusion Score (recomputed)</td>
                  <td className="px-4 sm:px-5 py-2.5 text-right font-bold text-maw-text-main">{last.fusion != null ? last.fusion.toFixed(3) : '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

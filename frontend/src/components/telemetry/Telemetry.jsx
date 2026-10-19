import { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { Card, CardHeader } from '../ui/Card';
import { ApiErrorState, EmptyState, LoadingState } from '../ui/States';
import StatusBadge from '../ui/StatusBadge';
import { Activity, Cpu } from 'lucide-react';
import { telemetryService } from '../../services/telemetryService';
import { deviceService } from '../../services/deviceService';
import { METRIC_KEYS } from '../../lib/adapters';

const TIME_RANGES = [
  { label: '1H', value: '1h', hours: 1 },
  { label: '6H', value: '6h', hours: 6 },
  { label: '12H', value: '12h', hours: 12 },
  { label: '24H', value: '24h', hours: 24 },
  { label: '7D', value: '7d', hours: 168 },
];

// Pivot telemetry rows (one row per metric sample) into chart points keyed by timestamp.
function toSeries(rows) {
  const byTime = new Map();
  for (const row of rows) {
    const key = METRIC_KEYS[row.metric];
    if (!key) continue;
    const point = byTime.get(row.recorded_at) || { timestamp: row.recorded_at };
    point[key] = Number(row.value);
    byTime.set(row.recorded_at, point);
  }
  return [...byTime.values()]
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((p) => ({ ...p, time: new Date(p.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }));
}

// Latest non-empty value of a metric (series may have gaps per metric).
function latest(series, key) {
  for (let i = series.length - 1; i >= 0; i--) if (series[i][key] != null) return series[i][key];
  return null;
}

export default function Telemetry({ crossingId, crossing }) {
  const [timeRange, setTimeRange] = useState('24h');
  const [rows, setRows] = useState([]);
  const [hardware, setHardware] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('vibration');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const selectedHours = TIME_RANGES.find((r) => r.value === timeRange)?.hours || 1;

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    Promise.all([
      telemetryService.getAll({ crossing_id: crossingId, limit: 1000 }),
      deviceService.getAll({ crossing_id: crossingId }).catch(() => ({ data: [] })),
    ])
      .then(([tel, dev]) => {
        if (!active) return;
        setRows(tel.data || []);
        setHardware(dev.data || []);
      })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [crossingId, reloadKey]);

  const series = useMemo(() => toSeries(rows), [rows]);
  const data = useMemo(() => {
    const since = Date.now() - selectedHours * 3600000;
    return series.filter((p) => new Date(p.timestamp).getTime() >= since);
  }, [series, selectedHours]);

  const fmt = (v, digits) => (v == null ? '—' : Number(v).toFixed(digits));
  const metrics = [
    { key: 'vibration', label: 'Vibration', color: '#005AA9', unit: 'g', current: fmt(latest(series, 'vibration'), 2), threshold: 0.75, over: (v) => v >= 0.75 },
    { key: 'magnetic', label: 'Magnetic field', color: '#0F8A5F', unit: 'µT', current: fmt(latest(series, 'magnetic'), 1), threshold: 40, over: (v) => v >= 40 },
    { key: 'acoustic', label: 'Sound level', color: '#F58220', unit: 'dB', current: fmt(latest(series, 'acoustic'), 0), threshold: 70, over: (v) => v >= 70 },
    { key: 'rssi', label: 'Signal strength', color: '#64748B', unit: 'dBm', current: crossing?.rssi ?? '—', threshold: -90, over: () => false },
  ];

  const selected = metrics.find((m) => m.key === selectedMetric);
  const hasSeries = data.some((p) => p[selectedMetric] != null);

  if (error) {
    return <Card><ApiErrorState error={error} onRetry={() => setReloadKey((k) => k + 1)} /></Card>;
  }

  return (
    <div className="space-y-5">
      {/* Current readings — click to chart. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const breached = metric.over(parseFloat(metric.current));
          const active = selectedMetric === metric.key;
          return (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              className={`text-left bg-maw-card rounded-maw border p-4 transition-colors ${
                active ? 'border-maw-primary' : 'border-maw-border hover:border-maw-border-strong'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-maw-text-muted">{metric.label}</span>
                {breached && <span className="status-dot bg-maw-critical animate-maw-alert" />}
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-display font-bold" style={{ color: metric.color }}>
                  {metric.current}
                </span>
                <span className="text-xs text-maw-text-subtle">{metric.unit}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader
          title={`${selected?.label} over time`}
          eyebrow={`Last ${selectedHours}h · ${crossing?.name || 'Crossing'}`}
          icon={Activity}
          action={
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                {TIME_RANGES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setTimeRange(r.value)}
                    className={`px-2 py-1 rounded-maw-sm text-[11px] font-mono font-semibold ${
                      timeRange === r.value ? 'bg-maw-primary text-white' : 'text-maw-text-muted hover:text-maw-text-main'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="text-right">
                <div className="text-[11px] text-maw-text-subtle">Threshold</div>
                <div className="text-sm font-mono font-semibold text-maw-accent">{selected?.threshold} {selected?.unit}</div>
              </div>
            </div>
          }
        />
        <div className="p-4 sm:p-5">
          {isLoading ? (
            <div className="h-72"><LoadingState label="Loading telemetry…" /></div>
          ) : !hasSeries ? (
            <div className="h-72 flex items-center justify-center">
              <EmptyState
                icon={Activity}
                title="No telemetry in this range"
                description={selectedMetric === 'rssi' ? 'Signal strength history is not recorded yet.' : 'Try a longer time range.'}
              />
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="maw-metric-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={selected?.color} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={selected?.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--maw-border)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--maw-text-subtle)" fontSize={10} fontFamily="IBM Plex Mono" tickLine={false} minTickGap={32} />
                  <YAxis stroke="var(--maw-text-subtle)" fontSize={10} fontFamily="IBM Plex Mono" tickLine={false} axisLine={false} width={44} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--maw-card)', border: '1px solid var(--maw-border)', borderRadius: '8px', color: 'var(--maw-text-main)', fontSize: 12 }}
                    itemStyle={{ color: selected?.color }}
                    labelStyle={{ color: 'var(--maw-text-subtle)', fontWeight: 600 }}
                  />
                  {selected && selected.key !== 'rssi' && (
                    <ReferenceLine y={selected.threshold} stroke="var(--maw-accent)" strokeDasharray="4 4" strokeWidth={1} />
                  )}
                  <Area type="monotone" dataKey={selectedMetric} stroke={selected?.color} strokeWidth={2} fillOpacity={1} fill="url(#maw-metric-fill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      {/* Sensor status */}
      <Card>
        <CardHeader title="Sensor status" eyebrow="On-site hardware" />
        {hardware.length === 0 ? (
          <EmptyState icon={Cpu} title="No hardware reporting" description="Components appear here once they publish over MQTT." />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-maw-border-subtle">
            {hardware.map((hw) => (
              <div key={hw.id} className="p-4 bg-maw-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-maw-text-main truncate">{hw.name || hw.id}</span>
                  <StatusBadge
                    status={hw.status === 'online' ? 'safe' : hw.status === 'degraded' ? 'warning' : 'offline'}
                    label={hw.status === 'online' ? 'OK' : hw.status || 'Unknown'}
                  />
                </div>
                <div className="text-xs text-maw-text-subtle mt-1.5">{[hw.component_type, hw.model].filter(Boolean).join(' · ') || '—'}</div>
                <div className="text-xs text-maw-text-subtle font-mono mt-0.5">
                  {hw.last_seen_at ? new Date(hw.last_seen_at).toLocaleTimeString('id-ID') : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { mockCrossings } from '../../lib/mockData';
import { Card, CardHeader } from '../ui/Card';
import { LoadingState } from '../ui/States';
import StatusBadge from '../ui/StatusBadge';
import { Activity } from 'lucide-react';

const TIME_RANGES = [
  { label: '1H', value: '1h', hours: 1 },
  { label: '6H', value: '6h', hours: 6 },
  { label: '12H', value: '12h', hours: 12 },
  { label: '24H', value: '24h', hours: 24 },
  { label: '7D', value: '7d', hours: 168 },
];

const generateTelemetryData = (hours = 1, crossingId = 'crossing-03') => {
  const now = new Date();
  const dataPoints = [];
  const interval = hours <= 1 ? 5 : hours <= 6 ? 15 : 30;
  const totalPoints = Math.floor((hours * 60) / interval);

  for (let i = totalPoints; i >= 0; i--) {
    const timestamp = new Date(now - i * interval * 60000);
    const isRecent = i < 5;
    const crossing = mockCrossings.find((c) => c.id === crossingId);
    const isCritical = crossing?.status === 'critical';

    dataPoints.push({
      time: timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      timestamp: timestamp.toISOString(),
      vibration: isCritical && isRecent ? 0.75 + Math.random() * 0.2 : 0.1 + Math.random() * 0.3,
      magnetic: isCritical && isRecent ? 35 + Math.random() * 15 : 5 + Math.random() * 10,
      acoustic: isCritical && isRecent ? 60 + Math.random() * 20 : 20 + Math.random() * 25,
      rssi: -80 + Math.random() * 30,
    });
  }

  return dataPoints;
};

export default function Telemetry({ crossingId = 'crossing-03' }) {
  const [timeRange, setTimeRange] = useState('1h');
  const [data, setData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('vibration');
  const [isLoading, setIsLoading] = useState(false);

  const selectedHours = TIME_RANGES.find((r) => r.value === timeRange)?.hours || 1;
  const crossing = mockCrossings.find((c) => c.id === crossingId);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setData(generateTelemetryData(selectedHours, crossingId));
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [timeRange, crossingId, selectedHours]);

  const last = data[data.length - 1] || {};
  const metrics = [
    { key: 'vibration', label: 'Vibration', color: '#005AA9', unit: 'g', current: last.vibration?.toFixed(2) ?? '0.00', threshold: 0.75, over: (v) => v >= 0.75 },
    { key: 'magnetic', label: 'Magnetic field', color: '#0F8A5F', unit: 'µT', current: last.magnetic?.toFixed(1) ?? '0.0', threshold: 40, over: (v) => v >= 40 },
    { key: 'acoustic', label: 'Sound level', color: '#F58220', unit: 'dB', current: last.acoustic?.toFixed(0) ?? '0', threshold: 70, over: (v) => v >= 70 },
    { key: 'rssi', label: 'Signal strength', color: '#64748B', unit: 'dBm', current: last.rssi?.toFixed(0) ?? '-80', threshold: -90, over: () => false },
  ];

  const selected = metrics.find((m) => m.key === selectedMetric);

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
            <div className="text-right">
              <div className="text-[11px] text-maw-text-subtle">Threshold</div>
              <div className="text-sm font-mono font-semibold text-maw-accent">{selected?.threshold} {selected?.unit}</div>
            </div>
          }
        />
        <div className="p-4 sm:p-5">
          {isLoading ? (
            <div className="h-72"><LoadingState label="Loading telemetry…" /></div>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-maw-border-subtle">
          {[
            { name: 'MPU6050', type: 'Vibration', temp: '42°C' },
            { name: 'HMC5883L', type: 'Magnetic', temp: '38°C' },
            { name: 'MAX9814', type: 'Acoustic', temp: '35°C' },
            { name: 'ESP32', type: 'MCU', temp: '45°C' },
          ].map((sensor) => (
            <div key={sensor.name} className="p-4 bg-maw-card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-maw-text-main truncate">{sensor.name}</span>
                <StatusBadge status="safe" label="OK" />
              </div>
              <div className="text-xs text-maw-text-subtle mt-1.5">{sensor.type}</div>
              <div className="text-xs text-maw-text-subtle font-mono mt-0.5">{sensor.temp}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

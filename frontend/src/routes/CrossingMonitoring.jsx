import { useState } from 'react';
import { ArrowLeft, AlertTriangle, Train, Shield, Activity, Wifi, Clock, MapPin } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSimulationStore } from '../store/simulationStore';
import { useCrossingsLive } from '../hooks/useCrossingsLive';
import { useEvents } from '../hooks/useEvents';
import { eventStatus } from '../lib/adapters';
import { ApiErrorState, EmptyState, LoadingState } from '../components/ui/States';
import Telemetry from '../components/telemetry/Telemetry';
import { Card, CardHeader } from '../components/ui/Card';
import StatusBadge, { getStatusMeta } from '../components/ui/StatusBadge';
import SimulationBanner from '../components/ui/SimulationBanner';
import GateControl from '../components/gate/GateControl';

function SafetyPanel({ icon: Icon, title, detected, textPositive, textNegative }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1.5">
        <Icon className={detected ? 'text-maw-critical' : 'text-maw-safe'} size={20} />
        <span className="font-display font-semibold text-maw-text-main text-sm">{title}</span>
      </div>
      <div className={`text-2xl font-mono font-bold ${detected ? 'text-maw-critical' : 'text-maw-safe'}`}>
        {detected ? 'DETECTED' : 'CLEAR'}
      </div>
      <p className="text-sm text-maw-text-muted mt-1.5">{detected ? textNegative : textPositive}</p>
    </div>
  );
}

export default function CrossingMonitoring() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { crossingStatuses } = useSimulationStore();

  const [activeTab, setActiveTab] = useState('overview');
  const { data: baseCrossing, loading, error, reload } = useCrossingsLive(id);
  const { data: events, loading: eventsLoading } = useEvents({ crossing_id: id, limit: 20 });

  if (loading && !baseCrossing) {
    return <div className="p-4 sm:p-6 lg:p-8"><LoadingState label="Loading crossing…" /></div>;
  }
  if (error || !baseCrossing) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto">
        <Card>
          {error?.message === 'Crossing not found' || !error
            ? <EmptyState icon={AlertTriangle} title="Crossing not found" description={`No crossing with id "${id}".`} />
            : <ApiErrorState error={error} onRetry={reload} />}
        </Card>
      </div>
    );
  }

  const crossing = { ...baseCrossing, status: crossingStatuses[id] || baseCrossing.status };
  const statusMeta = getStatusMeta(crossing.status);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'telemetry', label: 'Live Telemetry' },
    { id: 'network', label: 'Network' },
    { id: 'history', label: 'Event History' },
  ];

  const sensorReadings = [
    { label: 'Vibration', value: crossing.sensors.vibration?.toFixed(2) ?? '—', unit: 'g (acceleration)' },
    { label: 'Magnetic field', value: crossing.sensors.magnetic?.toFixed(2) ?? '—', unit: 'µT (microtesla)' },
    { label: 'Sound level', value: crossing.sensors.acoustic?.toFixed(2) ?? '—', unit: 'dB (decibel)' },
    { label: 'Signal strength', value: crossing.rssi ?? '—', unit: 'dBm (RSSI)' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-maw-surface border-b border-maw-border">
        <div className="p-4 sm:p-6 space-y-4 max-w-[1500px] mx-auto w-full">
          <SimulationBanner />
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/map')}
              className="p-2 hover:bg-maw-hover rounded-maw-sm transition-colors text-maw-text-muted shrink-0"
              aria-label="Back to map"
            >
              <ArrowLeft size={19} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="eyebrow">{crossing.id}</div>
              <h1 className="text-xl sm:text-2xl font-display font-bold text-maw-text-main truncate">{crossing.name}</h1>
              <p className="text-sm text-maw-text-muted flex items-center gap-1 truncate">
                <MapPin size={12} /> {crossing.location}
              </p>
            </div>
            <StatusBadge status={crossing.status} size="md" showIcon className="shrink-0" />
          </div>

          {/* Safety state — the dominant block on this page. */}
          <div className={`rounded-maw border ${statusMeta.border} ${statusMeta.soft} p-5 ${crossing.status === 'critical' ? 'border-l-2 border-l-maw-critical' : ''}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <SafetyPanel
                icon={Train}
                title="Train detection"
                detected={crossing.trainDetected}
                textPositive="No train activity detected at this time."
                textNegative="Train is currently approaching or crossing the intersection."
              />
              <SafetyPanel
                icon={AlertTriangle}
                title="Obstacle detection"
                detected={crossing.obstacleDetected}
                textPositive="Crossing area is clear of obstructions."
                textNegative="Foreign object detected in crossing area — immediate action required."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-maw-surface border-b border-maw-border">
        <div className="px-4 sm:px-6 max-w-[1500px] mx-auto w-full">
          <div className="flex gap-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3.5 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-maw-primary text-maw-primary'
                    : 'border-transparent text-maw-text-muted hover:text-maw-text-main'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
        <div className="max-w-[1500px] mx-auto w-full space-y-5">
          {activeTab === 'overview' && (
            <>
              <GateControl crossingId={crossing.id} crossingName={crossing.name} />

              <Card>
                <CardHeader title="Sensor readings" eyebrow="Latest sample" icon={Activity} />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-maw-border-subtle">
                  {sensorReadings.map((s) => (
                    <div key={s.label} className="p-4 bg-maw-card">
                      <div className="text-xs text-maw-text-muted mb-1.5">{s.label}</div>
                      <div className="text-2xl font-mono font-bold text-maw-text-main">{s.value}</div>
                      <div className="text-[11px] text-maw-text-subtle mt-1">{s.unit}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader title="MAW device status" eyebrow="Node health" icon={Shield} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 sm:p-5">
                  {[
                    { icon: Shield, label: 'Device', value: (crossing.connectivity || 'unknown').toUpperCase(), tone: 'text-maw-safe' },
                    { icon: Wifi, label: 'Signal', value: crossing.rssi != null ? `${crossing.rssi} dBm` : '—', tone: 'text-maw-text-main' },
                    { icon: Activity, label: 'Link quality', value: crossing.snr != null ? `${crossing.snr} dB SNR` : '—', tone: 'text-maw-text-main' },
                  ].map((d) => (
                    <div key={d.label} className="flex items-center gap-3 p-3.5 bg-maw-hover rounded-maw-sm border border-maw-border-subtle">
                      <div className="flex items-center justify-center h-9 w-9 rounded-maw-sm bg-maw-surface text-maw-primary border border-maw-border-subtle">
                        <d.icon size={17} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-maw-text-subtle">{d.label}</div>
                        <div className={`text-sm font-mono font-semibold ${d.tone}`}>{d.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="flex items-center justify-center gap-2 text-sm text-maw-text-subtle">
                <Clock size={13} /> Last update {crossing.lastUpdate ? new Date(crossing.lastUpdate).toLocaleTimeString('id-ID') : '—'}
              </div>
            </>
          )}

          {activeTab === 'telemetry' && <Telemetry crossingId={crossing.id} crossing={crossing} />}

          {activeTab === 'network' && (
            <Card>
              <CardHeader title="LoRa mesh network" eyebrow="Link status" icon={Wifi} />
              <div className="divide-y divide-maw-border-subtle">
                {[
                  { title: 'Gateway connection', sub: 'Central gateway node', right: <StatusBadge status="safe" label="Online" /> },
                  { title: 'Signal strength (RSSI)', sub: `${crossing.rssi} dBm`, right: <span className="text-sm font-mono text-maw-text-muted">{crossing.rssi > -70 ? '●●●●○' : crossing.rssi > -80 ? '●●●○○' : '●●○○○'}</span> },
                  { title: 'Signal-to-noise (SNR)', sub: `${crossing.snr} dB`, right: <span className="text-sm font-mono text-maw-text-muted">{crossing.snr > 10 ? 'Excellent' : crossing.snr > 5 ? 'Good' : 'Fair'}</span> },
                ].map((row) => (
                  <div key={row.title} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-maw-text-main">{row.title}</div>
                      <div className="text-xs text-maw-text-subtle">{row.sub}</div>
                    </div>
                    {row.right}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'history' && (
            <Card>
              <CardHeader title="Recent events" eyebrow="This crossing" icon={Clock} />
              {eventsLoading ? (
                <LoadingState label="Loading events…" />
              ) : events.length === 0 ? (
                <EmptyState icon={Clock} title="No events for this crossing" />
              ) : (
                <div className="divide-y divide-maw-border-subtle">
                  {events.map((event) => (
                    <div key={event.id} className="flex gap-3 px-4 sm:px-5 py-3.5">
                      <span className={`mt-1.5 status-dot ${getStatusMeta(eventStatus(event)).dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-maw-text-main">{event.title}</div>
                        <div className="text-xs text-maw-text-muted">{event.description}</div>
                      </div>
                      <div className="text-xs font-mono text-maw-text-subtle shrink-0">
                        {event.occurred_at ? new Date(event.occurred_at).toLocaleTimeString('id-ID') : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

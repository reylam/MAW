import { useEffect, useState } from 'react';
import { Cpu, Radio, Activity, Signal, HardDrive } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import StatGrid from '../components/ui/StatGrid';
import StatusBadge from '../components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { deviceService } from '../services/deviceService.js';

function batteryTone(b) {
  return b > 70 ? 'bg-maw-safe' : b > 30 ? 'bg-maw-warning' : 'bg-maw-critical';
}

// Map a hardware status to the shared status vocabulary.
const STATUS_MAP = { online: 'safe', degraded: 'warning', offline: 'offline' };
const STATUS_LABEL = { online: 'Online', degraded: 'Degraded', offline: 'Offline' };

function DeviceIcon({ type }) {
  const Icon = type === 'processor' ? Cpu : type === 'transceiver' ? Radio : type === 'sensor' ? Activity : Signal;
  return <Icon size={17} />;
}

// Human "x seconds ago" from an ISO timestamp.
function timeAgo(iso) {
  if (!iso) return '-';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function HardwareCard({ device }) {
  const uiStatus = STATUS_MAP[device.status] || 'offline';
  const battery = device.battery_level ?? 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center h-9 w-9 rounded-maw-sm bg-maw-hover text-maw-primary shrink-0">
            <DeviceIcon type={device.component_type} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-maw-text-main truncate">{device.name}</h3>
            <div className="text-xs text-maw-text-subtle truncate">{device.model}</div>
          </div>
        </div>
        <StatusBadge status={uiStatus} label={STATUS_LABEL[device.status] || 'Unknown'} />
      </div>

      <div className="space-y-2.5 pt-4 border-t border-maw-border-subtle text-sm">
        {typeof device.rssi === 'number' && (
          <div className="flex justify-between">
            <span className="text-maw-text-muted">RSSI</span>
            <span className="font-mono text-maw-text-main">{device.rssi} dBm</span>
          </div>
        )}
        {device.firmware_version && (
          <div className="flex justify-between">
            <span className="text-maw-text-muted">Firmware</span>
            <span className="font-mono text-maw-text-main">v{device.firmware_version}</span>
          </div>
        )}
        {typeof device.battery_level === 'number' && (
          <div className="flex items-center justify-between">
            <span className="text-maw-text-muted">Battery</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-maw-text-main">{battery}%</span>
              <div className="w-20 h-1.5 bg-maw-border rounded-full overflow-hidden">
                <div className={`h-full ${batteryTone(battery)}`} style={{ width: `${battery}%` }} />
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-maw-text-muted">Last seen</span>
          <span className="font-mono text-maw-text-subtle">{timeAgo(device.last_seen_at)}</span>
        </div>
      </div>
    </Card>
  );
}

export default function DeviceHealth() {
  const [devices, setDevices] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // `silent` refreshes (polling) update data without flashing the loading state.
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    return Promise.all([deviceService.getAll(), deviceService.health()])
      .then(([list, summary]) => {
        setDevices(list.data || []);
        setHealth(summary.data || null);
      })
      .catch((err) => setError(err))
      .finally(() => { if (!silent) setLoading(false); });
  };

  // Data is driven live by hardware over MQTT, so poll periodically to reflect
  // new readings and offline transitions without a manual refresh.
  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, []);

  // Group hardware components by crossing for a readable inventory.
  const groups = devices.reduce((acc, d) => {
    const key = d.crossing_id || 'unknown';
    if (!acc[key]) acc[key] = { crossing_id: key, crossing_name: d.crossing_name || key, items: [] };
    acc[key].items.push(d);
    return acc;
  }, {});
  const groupList = Object.values(groups);

  const total = health?.total_devices ?? devices.length;
  const online = health?.online ?? devices.filter((d) => d.status === 'online').length;
  const criticalFailures = health?.critical_failures ?? devices.filter((d) => d.status === 'offline').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1500px] mx-auto">
      <PageHeader
        eyebrow="Hardware"
        title="Device health"
        description="Live hardware status reported over MQTT, grouped by crossing. Auto-refreshes."
      />

      {loading ? (
        <Card><LoadingState label="Loading hardware…" /></Card>
      ) : error ? (
        <Card>
          <ErrorState
            title="Couldn't load device health"
            description={error.message}
            action={
              <button onClick={load} className="text-sm font-semibold text-maw-primary hover:text-maw-primary-hover">
                Retry
              </button>
            }
          />
        </Card>
      ) : devices.length === 0 ? (
        <Card>
          <EmptyState
            icon={HardDrive}
            title="Waiting for hardware"
            description="No components have reported yet. Field devices appear here automatically once they publish over MQTT."
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <StatGrid
              cols={4}
              items={[
                { label: 'Online components', value: `${online}/${total}`, tone: online === total ? 'safe' : 'warning' },
                { label: 'Degraded', value: String(health?.degraded ?? 0), tone: (health?.degraded ?? 0) > 0 ? 'warning' : 'muted' },
                { label: 'Avg. battery', value: `${Math.round(health?.average_battery ?? 0)}`, suffix: '%', tone: 'primary' },
                { label: 'Critical failures', value: String(criticalFailures), tone: criticalFailures > 0 ? 'critical' : 'muted' },
              ]}
            />
          </Card>

          {groupList.map((group) => (
            <div key={group.crossing_id} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-sm font-display font-semibold text-maw-text-main">{group.crossing_name}</h2>
                <span className="text-[11px] font-mono text-maw-text-subtle">
                  {group.items.filter((d) => d.status === 'online').length}/{group.items.length} online
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.items.map((device) => (
                  <HardwareCard key={device.id} device={device} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

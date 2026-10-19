import { mockLoRaMesh } from '../lib/mockData';
import { Radio, Wifi, Signal } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import StatGrid from '../components/ui/StatGrid';
import StatusBadge from '../components/ui/StatusBadge';
import SimulationBanner from '../components/ui/SimulationBanner';

function batteryTone(b) {
  return b > 70 ? 'text-maw-safe' : b > 30 ? 'text-maw-warning' : 'text-maw-critical';
}

export default function Network() {
  const gateway = mockLoRaMesh.find((n) => n.type === 'gateway');
  const nodes = mockLoRaMesh.filter((n) => n.type !== 'gateway');
  const onlineCount = mockLoRaMesh.filter((n) => n.status === 'online').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1500px] mx-auto">
      <SimulationBanner note="Network data may be affected by simulation." />
      <PageHeader
        eyebrow="Connectivity"
        title="LoRa mesh network"
        description="Topology and link quality across sensor and warning nodes."
      />

      <Card className="overflow-hidden">
        <StatGrid
          items={[
            { label: 'Total nodes', value: mockLoRaMesh.length },
            { label: 'Online', value: onlineCount, suffix: `/ ${mockLoRaMesh.length}`, tone: 'safe' },
            { label: 'Avg RSSI', value: '-62', suffix: 'dBm', tone: 'primary' },
            { label: 'Avg SNR', value: '10.8', suffix: 'dB', tone: 'primary' },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Mesh topology" eyebrow="Gateway → nodes" icon={Radio} />
        <div className="p-5 sm:p-6">
          {/* Gateway — a clear parent card, no glow / gradient. */}
          <div className="mx-auto max-w-md bg-maw-primary-soft border border-maw-primary/30 rounded-maw p-4 flex items-center gap-3.5">
            <div className="flex items-center justify-center h-11 w-11 rounded-maw-sm bg-maw-primary text-white shrink-0">
              <Radio size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-mono text-maw-text-subtle">{gateway.nodeId}</div>
              <div className="font-display font-semibold text-maw-text-main truncate">{gateway.name}</div>
            </div>
            <StatusBadge status="safe" label="Online" />
          </div>

          {/* Connector */}
          <div className="flex justify-center" aria-hidden="true">
            <span className="h-6 w-px bg-maw-border" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes.map((node) => (
              <div key={node.nodeId} className="bg-maw-surface rounded-maw border border-maw-border p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-maw-sm bg-maw-hover text-maw-text-muted shrink-0">
                    {node.type === 'sensor' ? <Signal size={17} /> : <Wifi size={17} />}
                  </div>
                  <StatusBadge status="safe" label="Online" />
                </div>
                <div className="text-sm font-display font-semibold text-maw-text-main truncate">{node.name}</div>
                <div className="text-[11px] text-maw-text-subtle font-mono mb-3">{node.nodeId}</div>

                <div className="space-y-2 pt-3 border-t border-maw-border-subtle text-xs">
                  <div className="flex justify-between">
                    <span className="text-maw-text-muted">RSSI</span>
                    <span className="font-mono text-maw-text-main">{node.rssi} dBm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-maw-text-muted">SNR</span>
                    <span className="font-mono text-maw-text-main">{node.snr} dB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-maw-text-muted">Battery</span>
                    <span className={`font-mono font-semibold ${batteryTone(node.battery)}`}>{node.battery}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, OctagonAlert, Hourglass, HelpCircle } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { useMawFeed } from '../../store/mawFeedStore';

// Same instruction the petugas app shows (mobile/DESIGN.md 4.3), mirrored for operators.
const META = {
  AMAN: { title: 'BARRIER MAY OPEN', icon: CheckCircle2, cls: 'bg-maw-safe-soft border-maw-safe-border text-maw-safe' },
  SIAGA: { title: 'PREPARE TO CLOSE', icon: AlertTriangle, cls: 'bg-maw-warning-soft border-maw-warning-border text-maw-warning' },
  TUTUP: { title: 'CLOSE BARRIER NOW', icon: OctagonAlert, cls: 'bg-maw-critical-soft border-maw-critical-border text-maw-critical' },
  MENUNGGU_AMAN: { title: 'KEEP CLOSED', icon: Hourglass, cls: 'bg-maw-critical-soft border-maw-critical-border text-maw-critical' },
  CEK_MANUAL: { title: 'MANUAL CHECK', icon: HelpCircle, cls: 'bg-maw-hover border-maw-border text-maw-text-main' },
};

export default function BarrierInstruction({ crossingId }) {
  const s = useMawFeed((st) => st.states[crossingId]);
  const connected = useMawFeed((st) => st.connected);

  // Re-check data age every second (fail-safe, like the petugas app).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const stale = !connected || !s || !s.received_at || now - new Date(s.received_at).getTime() > s.stale_max_s * 1000;
  const key = stale ? 'CEK_MANUAL' : s.state;
  const meta = META[key];
  const Icon = meta.icon;

  let detail;
  if (!connected) detail = 'Live feed disconnected.';
  else if (!s) detail = 'This crossing has no sensor node mapped (backend nodeMap.json).';
  else if (key === 'CEK_MANUAL') detail = s.cause || 'No fresh data from the sensor node.';
  else if (key === 'MENUNGGU_AMAN') detail = `Train leaving. May open in ${s.hold_remaining_s ?? '-'} s.`;
  else detail = s.reason;

  return (
    <Card>
      <CardHeader title="Barrier instruction" eyebrow="Live · same as petugas app" icon={Icon} />
      <div className="p-4 sm:p-5 space-y-3">
        <div className={`rounded-maw border p-4 flex items-center gap-3 ${meta.cls}`}>
          <Icon size={28} className={key === 'TUTUP' && !s?.acknowledged ? 'animate-maw-alert' : ''} />
          <div className="min-w-0">
            <div className="font-display font-bold text-lg">{meta.title}</div>
            <div className="text-sm opacity-90">{detail}</div>
          </div>
        </div>
        {s && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono text-maw-text-subtle">
            <span>Fusion {s.fusion_score?.toFixed(2) ?? '-'}{s.score_mismatch ? ` (node ${s.fusion_score_node?.toFixed(2)})` : ''}</span>
            <span>Node {s.node.node_id}{s.node.status ? ` · ${s.node.status}` : ''}</span>
            <span>T {s.thresholds.siaga.toFixed(2)}/{s.thresholds.tutup.toFixed(2)}</span>
            {s.acknowledged && <span>Confirmed by {s.acknowledged.by} {new Date(s.acknowledged.at).toLocaleTimeString('id-ID')}</span>}
          </div>
        )}
      </div>
    </Card>
  );
}

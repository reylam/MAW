import { useState } from 'react';
import { useCrossingsLive } from '../hooks/useCrossingsLive';
import { useSimulationStore } from '../store/simulationStore';
import { Radio, ChevronRight, MapPin } from 'lucide-react';
import { ApiErrorState, EmptyState, LoadingState } from '../components/ui/States';
import CrossingDetailModal from '../components/crossings/CrossingDetailModal';
import PageHeader from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import StatusBadge, { getStatusMeta } from '../components/ui/StatusBadge';

function DetailRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-maw-text-muted">{label}</span>
      <span className={`font-mono ${tone || 'text-maw-text-main'}`}>{value}</span>
    </div>
  );
}

export default function Crossings() {
  const [selectedCrossing, setSelectedCrossing] = useState(null);
  const { crossingStatuses } = useSimulationStore();
  const { data, loading, error, reload } = useCrossingsLive();
  const crossings = data.map((c) => ({ ...c, status: crossingStatuses[c.id] || c.status }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1500px] mx-auto">
      <PageHeader
        eyebrow="Field assets"
        title="Railway crossings"
        description="Status and telemetry for monitored level crossings."
      />

      {loading && crossings.length === 0 && <Card><LoadingState label="Loading crossings…" /></Card>}
      {error && <Card><ApiErrorState error={error} onRetry={reload} /></Card>}
      {!loading && !error && crossings.length === 0 && (
        <Card><EmptyState icon={Radio} title="No crossings registered" description="Crossings added to the backend will appear here." /></Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {crossings.map((crossing) => {
          const meta = getStatusMeta(crossing.status);
          return (
            <Card
              key={crossing.id}
              as="button"
              interactive
              onClick={() => setSelectedCrossing(crossing)}
              className="text-left group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex items-center justify-center h-9 w-9 rounded-maw-sm bg-maw-hover text-maw-text-muted shrink-0">
                      <Radio size={17} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-maw-text-subtle font-mono">{crossing.id}</div>
                      <h3 className="font-display font-semibold text-maw-text-main truncate">{crossing.name}</h3>
                      <div className="text-xs text-maw-text-subtle truncate flex items-center gap-1">
                        <MapPin size={11} /> {crossing.location}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={crossing.status} />
                </div>

                <div className="space-y-2.5 pt-4 border-t border-maw-border-subtle">
                  <DetailRow
                    label="Train"
                    value={crossing.trainDetected ? 'DETECTED' : 'CLEAR'}
                    tone={crossing.trainDetected ? 'text-maw-critical font-semibold' : 'text-maw-safe'}
                  />
                  <DetailRow label="Barrier" value={String(crossing.barrierStatus).toUpperCase()} />
                  <DetailRow
                    label="Obstacle"
                    value={crossing.obstacleDetected ? 'DETECTED' : 'NONE'}
                    tone={crossing.obstacleDetected ? 'text-maw-critical font-semibold' : 'text-maw-safe'}
                  />
                </div>

                <div className="mt-4 pt-3 border-t border-maw-border-subtle flex items-center justify-between text-xs text-maw-text-subtle">
                  <span>Updated {crossing.lastUpdate ? new Date(crossing.lastUpdate).toLocaleTimeString('id-ID') : '-'}</span>
                  <span className="flex items-center gap-0.5 text-maw-primary font-semibold group-hover:gap-1.5 transition-all">
                    Detail <ChevronRight size={13} />
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {selectedCrossing && (
        <CrossingDetailModal crossing={selectedCrossing} onClose={() => setSelectedCrossing(null)} />
      )}
    </div>
  );
}

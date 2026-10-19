import { useEffect, useState } from 'react';
import { mockEventTimeline } from '../lib/mockData';
import { eventService } from '../services/eventService';
import PageHeader from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { getStatusMeta } from '../components/ui/StatusBadge';
import { EmptyState, LoadingState } from '../components/ui/States';
import { Clock } from 'lucide-react';

// Map backend severities / event types to the shared status vocabulary.
function toStatus(ev) {
  const s = ev.severity || '';
  if (s === 'critical') return 'critical';
  if (s === 'warning') return 'warning';
  if (/gate|override/.test(ev.event_type || '')) return 'warning';
  return 'safe';
}

function normalize(ev) {
  return {
    id: ev.id,
    title: ev.title,
    description: ev.description,
    timestamp: ev.occurred_at || ev.timestamp,
    crossing: ev.crossing_id || ev.crossing || 'System',
    status: toStatus(ev),
    tag: ev.event_type || ev.type || 'event',
  };
}

export default function EventHistory() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventService
      .getAll({ limit: 50 })
      .then((res) => setEvents((res.data || []).map(normalize)))
      .catch(() =>
        setEvents(
          mockEventTimeline.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            timestamp: e.timestamp,
            crossing: e.crossing,
            status: e.type === 'critical' ? 'critical' : e.type === 'warning' ? 'warning' : 'safe',
            tag: e.type,
          }))
        )
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1000px] mx-auto">
      <PageHeader
        eyebrow="Audit trail"
        title="Event history"
        description="Chronological record of system, crossing, and operator events."
      />

      <Card>
        {loading ? (
          <LoadingState label="Loading events…" />
        ) : events.length === 0 ? (
          <EmptyState icon={Clock} title="No events logged" description="System and crossing events will appear here." />
        ) : (
          <ol className="relative">
            {/* Single quiet rail line, no gradient. */}
            <span className="absolute left-[26px] sm:left-[30px] top-5 bottom-5 w-px bg-maw-border" aria-hidden="true" />
            {events.map((event) => {
              const meta = getStatusMeta(event.status);
              return (
                <li key={event.id} className="relative flex gap-4 px-4 sm:px-5 py-4 border-b border-maw-border-subtle last:border-0">
                  <span className="relative z-10 mt-0.5 shrink-0">
                    <span className={`block h-3 w-3 rounded-full ${meta.dot} ring-4 ring-maw-card ${event.status === 'critical' ? 'animate-maw-alert' : ''}`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display font-semibold text-maw-text-main text-sm">{event.title}</h3>
                        <p className="text-sm text-maw-text-muted mt-0.5">{event.description}</p>
                      </div>
                      <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${meta.soft} ${meta.border} ${meta.fg}`}>
                        {String(event.tag).replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-maw-text-subtle">
                      <span>{event.crossing}</span>
                      <span className="text-maw-border-strong">·</span>
                      <span>{event.timestamp ? new Date(event.timestamp).toLocaleTimeString('id-ID') : '—'}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}

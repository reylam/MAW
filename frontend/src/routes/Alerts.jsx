import { useState } from 'react';
import { mockAlerts } from '../lib/mockData';
import { CheckCircle2, AlertTriangle, OctagonAlert, Info } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/States';

const FILTERS = ['all', 'critical', 'warning', 'system'];

const TYPE_META = {
  critical: { icon: OctagonAlert, fg: 'text-maw-critical', dot: 'bg-maw-critical', soft: 'bg-maw-critical-soft', border: 'border-maw-critical-border' },
  warning: { icon: AlertTriangle, fg: 'text-maw-warning', dot: 'bg-maw-warning', soft: 'bg-maw-warning-soft', border: 'border-maw-warning-border' },
  system: { icon: Info, fg: 'text-maw-primary', dot: 'bg-maw-primary', soft: 'bg-maw-primary-soft', border: 'border-maw-border' },
};

export default function Alerts() {
  const [filter, setFilter] = useState('all');

  const filteredAlerts = mockAlerts.filter((a) => (filter === 'all' ? true : a.type === filter));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1100px] mx-auto">
      <PageHeader
        eyebrow="Notifications"
        title="Alert center"
        description="Active warnings and alert history across the network."
        actions={
          <div className="flex items-center gap-1 bg-maw-surface p-1 rounded-maw border border-maw-border">
            {FILTERS.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-2.5 py-1.5 rounded-maw-sm text-xs font-semibold capitalize transition-colors ${
                  filter === type ? 'bg-maw-primary text-white' : 'text-maw-text-muted hover:text-maw-text-main'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        }
      />

      {filteredAlerts.length === 0 ? (
        <Card>
          <EmptyState icon={CheckCircle2} title="No alerts" description={`No ${filter === 'all' ? '' : filter + ' '}alerts to show right now.`} />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const meta = TYPE_META[alert.type] || TYPE_META.system;
            const Icon = meta.icon;
            const isUrgent = alert.type === 'critical' && !alert.resolved;
            return (
              <Card
                key={alert.id}
                className={`flex items-start gap-4 p-4 sm:p-5 ${isUrgent ? 'border-l-2 border-l-maw-critical' : ''}`}
              >
                <div className={`flex items-center justify-center h-10 w-10 rounded-maw-sm shrink-0 border ${meta.soft} ${meta.border} ${meta.fg}`}>
                  <Icon size={19} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${meta.soft} ${meta.border} ${meta.fg}`}>
                      {alert.type}
                    </span>
                    <span className="text-[11px] font-mono text-maw-text-subtle">{alert.crossingId}</span>
                  </div>
                  <h3 className="font-display font-semibold text-maw-text-main mt-1.5">{alert.title}</h3>
                  <p className="text-sm text-maw-text-muted mt-0.5">{alert.description}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono text-maw-text-subtle">
                    {new Date(alert.timestamp).toLocaleTimeString('id-ID')}
                  </div>
                  {alert.resolved ? (
                    <span className="inline-flex items-center gap-1 text-xs text-maw-safe font-semibold mt-2">
                      <CheckCircle2 size={13} /> Resolved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-maw-text-muted font-medium mt-2">
                      <span className={`status-dot ${meta.dot} ${isUrgent ? 'animate-maw-alert' : ''}`} /> Active
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

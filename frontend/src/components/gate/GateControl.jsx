import { useCallback, useEffect, useState } from 'react';
import { DoorOpen, DoorClosed, Lock, RotateCcw, UserCog, Clock3, AlertCircle } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { gateService } from '../../services/gateService';
import { useAuthStore } from '../../store/authStore';
import OpenGateDialog from './OpenGateDialog';

/*
  Operator gate control for a single crossing.

  Live gate state is read from the backend (GET /crossings/:id/gate) and every
  action is POSTed back, so the UI reflects the real device/override state
  rather than faking it in local state. A manual open is gated behind
  OpenGateDialog (safety confirmation + reason).
*/
export default function GateControl({ crossingId, crossingName }) {
  const operator = useAuthStore((s) => s.operator);
  const [gate, setGate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => {
    if (!crossingId) return;
    gateService
      .getStatus(crossingId)
      .then((res) => { setGate(res.data); setError(''); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [crossingId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const send = async (action, reason) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await gateService.control(crossingId, { action, operator, reason });
      setGate(res.data);
      setDialogOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isOpen = gate?.barrier_status === 'open';
  const manual = gate?.manual_override;

  return (
    <Card>
      <CardHeader
        eyebrow="Operator control"
        title="Manual gate control"
        icon={UserCog}
        action={
          <button
            onClick={refresh}
            className="p-1.5 rounded-maw-sm text-maw-text-subtle hover:bg-maw-hover hover:text-maw-text-main transition-colors"
            aria-label="Refresh gate status"
          >
            <RotateCcw size={14} />
          </button>
        }
      />

      <div className="p-4 sm:p-5 space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-maw bg-maw-critical-soft border border-maw-critical-border text-sm text-maw-critical">
            <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* Manual override banner — unmistakably distinct from automatic state. */}
        {manual && (
          <div className="rounded-maw border-l-4 border-l-maw-accent border border-maw-accent-border bg-maw-accent-soft p-4">
            <div className="flex items-center gap-2 text-maw-accent-hover">
              <UserCog size={16} />
              <span className="text-xs font-mono font-bold uppercase tracking-wider">Manual override active</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <dt className="text-maw-text-muted">Operator</dt>
              <dd className="font-semibold text-maw-text-main text-right truncate">{gate.operator?.name || '—'}</dd>
              <dt className="text-maw-text-muted">Reason</dt>
              <dd className="font-medium text-maw-text-main text-right">{gate.reason || '—'}</dd>
              {gate.since && (
                <>
                  <dt className="text-maw-text-muted flex items-center gap-1"><Clock3 size={12} /> Since</dt>
                  <dd className="font-mono text-maw-text-main text-right">
                    {new Date(gate.since).toLocaleTimeString('id-ID')}
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}

        {/* Current gate state */}
        <div className="flex items-center justify-between rounded-maw bg-maw-hover border border-maw-border-subtle px-4 py-3.5">
          <div>
            <div className="eyebrow mb-0.5">{manual ? 'Operator-controlled' : 'Automatic'} state</div>
            <div className={`flex items-center gap-2 text-lg font-display font-bold ${isOpen ? 'text-maw-accent-hover' : 'text-maw-safe'}`}>
              {isOpen ? <DoorOpen size={20} /> : <Lock size={18} />}
              {loading ? '…' : (gate?.barrier_status || 'unknown').toUpperCase()}
            </div>
          </div>
          {manual && gate?.automatic_status && (
            <div className="text-right">
              <div className="eyebrow mb-0.5">System reports</div>
              <div className="text-sm font-mono font-semibold text-maw-text-muted uppercase">{gate.automatic_status}</div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-2">
          {!isOpen ? (
            <button
              onClick={() => setDialogOpen(true)}
              disabled={loading || submitting}
              className="flex-1 py-2.5 px-4 bg-maw-accent hover:bg-maw-accent-hover text-white font-semibold text-sm rounded-maw transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <DoorOpen size={16} /> Open gate
            </button>
          ) : (
            <button
              onClick={() => send('close')}
              disabled={submitting}
              className="flex-1 py-2.5 px-4 bg-maw-primary hover:bg-maw-primary-hover text-white font-semibold text-sm rounded-maw transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <DoorClosed size={16} /> Close gate
            </button>
          )}
          {manual && (
            <button
              onClick={() => send('release')}
              disabled={submitting}
              className="py-2.5 px-4 border border-maw-border text-maw-text-muted font-semibold text-sm rounded-maw hover:bg-maw-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <RotateCcw size={15} /> Return to automatic
            </button>
          )}
        </div>

        <p className="text-xs text-maw-text-subtle">
          Opening the gate overrides the automatic safety system. The action is recorded with your name and
          reason in the activity log.
        </p>
      </div>

      {dialogOpen && (
        <OpenGateDialog
          crossingName={crossingName || gate?.crossing_name || 'this crossing'}
          automaticStatus={gate?.automatic_status}
          isSubmitting={submitting}
          onCancel={() => setDialogOpen(false)}
          onConfirm={(reason) => send('open', reason)}
        />
      )}
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';

/*
  Safety-critical confirmation for a manual gate open.

  Opening a railway crossing gate overrides the automatic system, which may be
  reporting an unsafe condition. The dialog forces the operator to acknowledge
  this and to record a reason before the action is sent to the backend.
*/
const REASONS = [
  'Sensor validation — crossing verified safe',
  'Sensor malfunction',
  'Gate system malfunction',
  'Scheduled maintenance',
  'Emergency',
  'Other',
];

export default function OpenGateDialog({ crossingName, automaticStatus, onCancel, onConfirm, isSubmitting }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !isSubmitting && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, isSubmitting]);

  const submit = (e) => {
    e.preventDefault();
    const finalReason = note.trim() ? `${reason} — ${note.trim()}` : reason;
    onConfirm(finalReason);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onClick={() => !isSubmitting && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm manual gate open"
    >
      <div
        className="bg-maw-card rounded-maw-lg border border-maw-border w-full max-w-md shadow-maw overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 sm:px-6 py-4 border-b border-maw-border flex items-start justify-between gap-3 bg-maw-warning-soft">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex items-center justify-center h-9 w-9 rounded-maw-sm bg-maw-surface border border-maw-warning-border text-maw-warning shrink-0">
              <ShieldAlert size={18} />
            </span>
            <div className="min-w-0">
              <div className="eyebrow text-maw-warning">Safety override</div>
              <h2 className="text-base font-display font-bold text-maw-text-main">Open railway gate?</h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-1.5 text-maw-text-subtle hover:text-maw-text-main rounded-maw-sm hover:bg-maw-surface transition-colors shrink-0 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 sm:p-6 space-y-5">
          <div className="flex gap-3 p-3 rounded-maw bg-maw-critical-soft border border-maw-critical-border">
            <AlertTriangle size={16} className="text-maw-critical shrink-0 mt-0.5" />
            <p className="text-sm text-maw-critical">
              The automatic system may currently be reporting an unsafe condition. Confirm that you have
              verified <span className="font-semibold">{crossingName}</span> is safe before opening the gate.
            </p>
          </div>

          {automaticStatus && (
            <div className="flex items-center justify-between text-sm px-1">
              <span className="text-maw-text-muted">Automatic system state</span>
              <span className="font-mono font-semibold uppercase text-maw-text-main">{automaticStatus}</span>
            </div>
          )}

          <div>
            <label htmlFor="reason" className="block text-xs font-semibold text-maw-text-muted uppercase tracking-wider mb-1.5">
              Reason for override
            </label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 bg-maw-surface border border-maw-border rounded-maw text-sm text-maw-text-main focus:outline-none focus:border-maw-primary transition-colors"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="note" className="block text-xs font-semibold text-maw-text-muted uppercase tracking-wider mb-1.5">
              Additional note <span className="text-maw-text-subtle normal-case font-normal">(optional)</span>
            </label>
            <textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2.5 bg-maw-surface border border-maw-border rounded-maw text-sm text-maw-text-main placeholder:text-maw-text-subtle focus:outline-none focus:border-maw-primary transition-colors resize-none"
              placeholder="Context for the activity log…"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="py-2.5 px-4 border border-maw-border text-maw-text-muted font-semibold text-sm rounded-maw hover:bg-maw-hover transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-maw-accent hover:bg-maw-accent-hover text-white font-semibold text-sm rounded-maw transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {isSubmitting ? 'Opening gate…' : 'Confirm & open gate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

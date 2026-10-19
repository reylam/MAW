import { Inbox, Loader2, AlertCircle } from 'lucide-react';

/* Shared empty / loading / error states so every list looks deliberate when it has nothing to show. */

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="flex items-center justify-center h-11 w-11 rounded-maw bg-maw-hover text-maw-text-subtle mb-3">
        <Icon size={20} />
      </div>
      <div className="text-sm font-semibold text-maw-text-main">{title}</div>
      {description && <p className="text-sm text-maw-text-subtle mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-maw-text-subtle">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

export function ApiErrorState({ error, onRetry }) {
  return (
    <ErrorState
      title="Cannot reach the MAW API"
      description={error?.message || 'Check that the backend is running.'}
      action={onRetry && (
        <button onClick={onRetry} className="px-3 py-1.5 rounded-maw-sm bg-maw-primary text-white text-xs font-semibold hover:bg-maw-primary-hover">
          Retry
        </button>
      )}
    />
  );
}

export function ErrorState({ title = 'Something went wrong', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="flex items-center justify-center h-11 w-11 rounded-maw bg-maw-critical-soft text-maw-critical mb-3">
        <AlertCircle size={20} />
      </div>
      <div className="text-sm font-semibold text-maw-text-main">{title}</div>
      {description && <p className="text-sm text-maw-text-subtle mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

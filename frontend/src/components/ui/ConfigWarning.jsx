import { TriangleAlert } from 'lucide-react';
import { configProblem } from '../../config/env';

// Visible on every page when the deployed build points at the wrong backend.
const problem = configProblem();

export default function ConfigWarning() {
  if (!problem) return null;
  return (
    <div
      role="alert"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[3000] w-[calc(100%-1.5rem)] max-w-xl flex items-start gap-2.5 rounded-maw border border-maw-critical-border bg-maw-critical-soft px-4 py-3 shadow-maw"
    >
      <TriangleAlert size={16} className="text-maw-critical shrink-0 mt-0.5" />
      <div className="text-sm text-maw-critical">
        <span className="font-semibold">Configuration problem.</span> {problem}
      </div>
    </div>
  );
}

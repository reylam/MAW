import { FlaskConical } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';

/*
  Shown whenever the dashboard is driven by simulated data instead of live
  sensors. Uses the accent (orange) in a controlled, informational way — a
  thin left rule rather than a loud filled card — so it signals "not live"
  without competing with real safety status.
*/
export default function SimulationBanner({ note = 'Showing simulated data. Not connected to live sensors.' }) {
  const isSimulationMode = useSimulationStore((s) => s.isSimulationMode);
  if (!isSimulationMode) return null;

  return (
    <div className="flex items-center gap-2.5 rounded-maw border border-maw-accent-border bg-maw-accent-soft border-l-2 border-l-maw-accent px-3.5 py-2.5">
      <FlaskConical size={15} className="text-maw-accent shrink-0" />
      <span className="text-xs font-semibold text-maw-accent uppercase tracking-wide">Simulation mode</span>
      <span className="text-xs text-maw-text-muted hidden sm:inline">· {note}</span>
    </div>
  );
}

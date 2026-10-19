import { FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMawFeed } from '../../store/mawFeedStore';

/*
  Shown while the backend Simulation Center is feeding scenario data into the
  MAW engine, so nobody mistakes simulated readings for live sensors. Uses the
  accent (orange) in a controlled, informational way - a thin left rule rather
  than a loud filled card.
*/
export default function SimulationBanner() {
  const sim = useMawFeed((s) => s.sim);
  if (!sim.running) return null;

  return (
    <div className="flex items-center gap-2.5 rounded-maw border border-maw-accent-border bg-maw-accent-soft border-l-2 border-l-maw-accent px-3.5 py-2.5">
      <FlaskConical size={15} className="text-maw-accent shrink-0" />
      <span className="text-xs font-semibold text-maw-accent uppercase tracking-wide">Simulation running</span>
      <span className="text-xs text-maw-text-muted truncate">· {sim.label}. Data is simulated, not from the sensor node.</span>
      <Link to="/simulation" className="ml-auto text-xs font-semibold text-maw-accent hover:underline shrink-0">Manage</Link>
    </div>
  );
}

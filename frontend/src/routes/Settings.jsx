import { useState } from 'react';
import { SlidersHorizontal, Gauge } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';

function WeightSlider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-maw-text-main font-medium">{label}</span>
        <span className="font-mono text-sm font-semibold text-maw-primary bg-maw-primary-soft px-2.5 py-0.5 rounded-maw-sm">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-maw-border rounded-full appearance-none cursor-pointer accent-maw-primary"
      />
    </div>
  );
}

export default function Settings() {
  const [weights, setWeights] = useState({ vibration: 0.5, magnetic: 0.3, acoustic: 0.2 });
  const [threshold, setThreshold] = useState(0.75);

  const total = weights.vibration + weights.magnetic + weights.acoustic;
  const isValid = Math.abs(total - 1.0) < 0.01;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Configuration"
        title="Detection settings"
        description="Tune the sensor fusion model used to detect train presence."
      />

      <Card>
        <CardHeader title="Weight calibration" eyebrow="Sensor fusion" icon={SlidersHorizontal} />
        <div className="p-5 sm:p-6 space-y-6">
          <p className="text-sm text-maw-text-muted">
            Adjust how strongly each sensor contributes to the fusion score. Weights must total 1.00.
          </p>
          <WeightSlider label="Vibration weight" value={weights.vibration} onChange={(v) => setWeights({ ...weights, vibration: v })} />
          <WeightSlider label="Magnetic weight" value={weights.magnetic} onChange={(v) => setWeights({ ...weights, magnetic: v })} />
          <WeightSlider label="Acoustic weight" value={weights.acoustic} onChange={(v) => setWeights({ ...weights, acoustic: v })} />

          <div className="pt-4 border-t border-maw-border-subtle flex justify-between items-center">
            <span className="text-sm text-maw-text-muted font-medium">Total weight</span>
            <span
              className={`font-mono text-sm font-semibold px-3 py-1 rounded-maw-sm border ${
                isValid
                  ? 'bg-maw-safe-soft border-maw-safe-border text-maw-safe'
                  : 'bg-maw-critical-soft border-maw-critical-border text-maw-critical'
              }`}
            >
              {total.toFixed(2)} / 1.00 {isValid ? '✓' : '✗'}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Activation threshold" eyebrow="Alarm trigger" icon={Gauge} />
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-sm text-maw-text-muted">The fusion score above which the system raises an alarm.</p>
          <div className="flex justify-between items-center bg-maw-hover p-4 rounded-maw-sm border border-maw-border-subtle">
            <span className="text-sm text-maw-text-main font-medium">Current threshold</span>
            <span className="font-mono text-xl font-bold text-maw-accent">{threshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="0.95"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-maw-border rounded-full appearance-none cursor-pointer accent-maw-accent"
          />
          <div className="flex justify-between text-xs text-maw-text-subtle">
            <span>More sensitive</span>
            <span>More conservative</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

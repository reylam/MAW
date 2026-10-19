import { useState } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { Activity, Play, RotateCcw, AlertTriangle, Train, Wifi, Mic, Magnet, Check } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';

const SCENARIOS = [
  { id: 'train-approaching', label: 'Train approaching', icon: Train, desc: 'Simulates a train approaching a crossing.' },
  { id: 'sensor-failure', label: 'Sensor failure', icon: Wifi, desc: 'Simulates a sensor node going offline.' },
  { id: 'network-degradation', label: 'Network degradation', icon: Activity, desc: 'Simulates poor LoRa signal quality.' },
];

const STAGES = [
  { label: 'Normal operation', desc: 'All systems operational.' },
  { label: 'Magnetic anomaly', desc: 'Hall Effect sensor detects magnetic field change.', icon: Magnet },
  { label: 'Vibration detected', desc: 'MPU6050 detects abnormal vibration levels.', icon: Activity },
  { label: 'Sound detected', desc: 'MAX9814 picks up approaching train sound.', icon: Mic },
  { label: 'Multi-sensor verification', desc: 'Correlation engine confirms train presence.', icon: Activity },
  { label: 'Critical alert', desc: 'System generates critical alert.', icon: AlertTriangle },
  { label: 'Crossing critical', desc: 'Crossing status changes to CRITICAL.', icon: Train },
];

export default function SimulationCenter() {
  const { isSimulationMode, activeScenario, scenarioStage, startScenario, nextStage, resetSimulation } = useSimulationStore();
  const [selectedScenario, setSelectedScenario] = useState('train-approaching');

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Testing"
        title="Simulation center"
        description="Validate system responses without live hardware."
      />

      {!isSimulationMode ? (
        <Card>
          <CardHeader title="Select scenario" eyebrow="Choose one" />
          <div className="p-5 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SCENARIOS.map((scenario) => {
                const Icon = scenario.icon;
                const active = selectedScenario === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    onClick={() => setSelectedScenario(scenario.id)}
                    className={`p-4 rounded-maw border text-left transition-colors ${
                      active ? 'border-maw-primary bg-maw-primary-soft' : 'border-maw-border hover:border-maw-border-strong'
                    }`}
                  >
                    <Icon className={active ? 'text-maw-primary' : 'text-maw-text-subtle'} size={20} />
                    <div className="font-semibold text-maw-text-main text-sm mt-2.5">{scenario.label}</div>
                    <div className="text-xs text-maw-text-muted mt-1">{scenario.desc}</div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => startScenario(selectedScenario)}
              className="w-full py-2.5 bg-maw-primary hover:bg-maw-primary-hover text-white rounded-maw font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Play size={16} /> Start simulation
            </button>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-maw border border-maw-accent-border bg-maw-accent-soft border-l-2 border-l-maw-accent px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Activity className="text-maw-accent animate-maw-alert shrink-0" size={18} />
              <div className="min-w-0">
                <div className="text-xs font-bold text-maw-accent uppercase tracking-wide">Simulation running</div>
                <div className="text-xs text-maw-text-muted truncate">
                  {SCENARIOS.find((s) => s.id === activeScenario)?.label}
                </div>
              </div>
            </div>
            <button
              onClick={resetSimulation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-maw-surface border border-maw-border rounded-maw-sm text-xs font-semibold text-maw-text-main hover:bg-maw-hover transition-colors shrink-0"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>

          <Card>
            <CardHeader title="Scenario progress" eyebrow={`Stage ${scenarioStage + 1} of ${STAGES.length}`} />
            <div className="p-4 sm:p-5 space-y-2">
              {STAGES.map((stage, index) => {
                const isActive = index === scenarioStage;
                const isPast = index < scenarioStage;
                const StageIcon = stage.icon;
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-maw-sm border transition-colors ${
                      isActive ? 'bg-maw-primary-soft border-maw-primary' : isPast ? 'bg-maw-safe-soft border-maw-safe-border' : 'bg-maw-hover border-maw-border-subtle'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ${
                        isActive ? 'bg-maw-primary text-white' : isPast ? 'bg-maw-safe text-white' : 'bg-maw-border text-maw-text-subtle'
                      }`}
                    >
                      {isPast ? <Check size={14} /> : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-maw-text-main">{stage.label}</div>
                      <div className="text-xs text-maw-text-muted">{stage.desc}</div>
                    </div>
                    {StageIcon && <StageIcon size={16} className={isActive ? 'text-maw-primary' : 'text-maw-text-subtle'} />}
                  </div>
                );
              })}
            </div>
            {scenarioStage < STAGES.length - 1 && (
              <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                <button
                  onClick={nextStage}
                  className="w-full py-2.5 bg-maw-primary hover:bg-maw-primary-hover text-white rounded-maw font-semibold text-sm transition-colors"
                >
                  Next stage
                </button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

import { getEngine } from './runtime.js';
import { loadScenarios, scenarioPayload } from './scenarios.js';

/*
  Server-side scenario runner for the web Simulation Center. Feeds the engine
  directly (no broker round trip) every HEARTBEAT seconds, exactly like a
  sensor node would, until stopped. Development / demo only.
*/

let timer = null;
let current = null; // { scenario, label, started_at, sent }
const listeners = new Set();

const emit = () => { const s = status(); for (const fn of listeners) fn(s); };

export function status() {
  return current ? { running: true, ...current } : { running: false };
}

export function listScenarios() {
  return Object.entries(loadScenarios()).map(([id, s]) => ({
    id,
    label: s.label || id,
    status: s.payload?.status ?? 'SAFE/WARNING/DANGER',
    fusion_score: s.payload?.fusion_score ?? null,
  }));
}

export function start(name) {
  const scenarios = loadScenarios();
  if (!scenarios[name]) return { error: `Scenario "${name}" not found` };
  stop({ silent: true });
  const engine = getEngine();
  const heartbeatMs = engine.config.HEARTBEAT_S * 1000;
  current = { scenario: name, label: scenarios[name].label || name, started_at: new Date().toISOString(), sent: 0 };
  const send = () => {
    engine.ingest(scenarioPayload(scenarios, name, current.sent), { source: 'simulate' });
    current.sent++;
  };
  send();
  timer = setInterval(send, heartbeatMs);
  emit();
  return { data: status() };
}

export function stop({ silent = false } = {}) {
  if (timer) clearInterval(timer);
  timer = null;
  const was = current;
  current = null;
  if (was && !silent) emit();
  return { data: status() };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

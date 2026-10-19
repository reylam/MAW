import { createEngine } from './engine.js';
import { loadMawConfig, loadNodeMap } from '../config/maw.js';
import { crossingService, eventService, readingService } from '../services/index.js';

/*
  The single MAW engine instance used by MQTT ingest, REST routes and the
  WebSocket server, wired to MongoDB / the event log.
*/

const fmtDuration = (s) => `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
const LABEL = { AMAN: 'AMAN', SIAGA: 'SIAGA', TUTUP: 'TUTUP', MENUNGGU_AMAN: 'MENUNGGU AMAN', CEK_MANUAL: 'CEK MANUAL' };

let engine = null;
let ticker = null;

export function getEngine() {
  if (engine) return engine;
  engine = createEngine({
    config: loadMawConfig(),
    nodeMap: loadNodeMap(),
    hooks: {
      onReading: (r) => readingService.record(r),
      onTransition: async (t) => {
        await crossingService.syncStatus(t.crossing_id, { status: t.dashboard_status, train_detected: t.train_detected });
        await eventService.record({
          event_type: 'maw_state',
          severity: t.severity,
          crossing_id: t.crossing_id,
          title: `${LABEL[t.from]} → ${LABEL[t.to]}`,
          description: t.cause || (t.duration_s != null ? `Palang tertutup ${fmtDuration(t.duration_s)}` : `Status perlintasan ${LABEL[t.to]}`),
          metadata: { from: t.from, to: t.to, duration_s: t.duration_s, cause: t.cause, node_id: t.node_id, score: t.score },
        });
      },
      onAcknowledge: (a) => eventService.record({
        event_type: 'maw_ack',
        severity: 'info',
        crossing_id: a.crossing_id,
        title: 'Palang dikonfirmasi tertutup',
        description: `Dikonfirmasi oleh ${a.by}`,
        metadata: { operator: a.operator, score: a.score, at: a.at },
      }),
      onScoreMismatch: (m) => eventService.record({
        event_type: 'maw_score_mismatch',
        severity: 'warning',
        crossing_id: m.crossing_id,
        title: 'Skor tidak konsisten',
        description: `Skor node ${m.score_node}, hitung ulang ${m.score_calc}`,
        metadata: m,
      }),
    },
  });
  return engine;
}

export function startMaw() {
  const e = getEngine();
  if (!ticker) ticker = setInterval(() => e.tick(), 1000);
  return e;
}

export function stopMaw() {
  if (ticker) clearInterval(ticker);
  ticker = null;
  engine?.stop();
}

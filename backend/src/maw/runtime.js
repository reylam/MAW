import { createEngine } from './engine.js';
import { loadMawConfig, loadNodeMap } from '../config/maw.js';
import { alertService, crossingService, deviceService, eventService, readingService } from '../services/index.js';

/*
  The single MAW engine instance used by MQTT ingest, REST routes and the
  WebSocket server, wired to MongoDB / the event log / the alert center.

  Alerts use the same shape as the existing alerts collection
  (alert-001 / ALT-001, severity, alert_type, English title, Indonesian message):
    train_detected   TUTUP (new closure)   -> acknowledged by the petugas, resolved when AMAN/SIAGA
    ack_overdue      no confirmation within MAW_CLOSE_DEADLINE_S -> resolved on confirmation / AMAN
    manual_check     CEK MANUAL            -> resolved when data is back
    score_mismatch   node score != recomputed -> resolved when they agree
    device_disconnected  a registered device (ESP32 / MPU6500 / HX711 / HMC5883L / MAX9814)
                     went disconnected -> resolved when it reconnects. While any device is
                     disconnected the crossing is CEK MANUAL (fail-safe).
*/

const fmtDuration = (s) => `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
const LABEL = { AMAN: 'AMAN', SIAGA: 'SIAGA', TUTUP: 'TUTUP', MENUNGGU_AMAN: 'MENUNGGU AMAN', CEK_MANUAL: 'CEK MANUAL' };
const fmtScore = (v) => (v == null ? '-' : Number(v).toFixed(2).replace('.', ','));

async function alertsFor(t) {
  if (t.to === 'TUTUP' && t.from !== 'MENUNGGU_AMAN') {
    await alertService.raise({
      crossing_id: t.crossing_id,
      device_id: t.device_id,
      alert_type: 'train_detected',
      severity: 'critical',
      title: 'Train Detected',
      message: `Kereta terdeteksi mendekat (Fusion Score ${fmtScore(t.score)}), petugas harus menutup palang`,
    });
  }
  // A disconnected device already has its own alert (device_disconnected): no duplicate manual_check.
  if (t.to === 'CEK_MANUAL' && !String(t.cause || '').startsWith('Perangkat terputus')) {
    await alertService.raise({
      crossing_id: t.crossing_id,
      device_id: t.device_id,
      alert_type: 'manual_check',
      severity: 'critical',
      title: 'Manual Check Required',
      message: `${t.cause || 'Data sensor tidak diterima'}, ikuti SOP manual`,
    });
  }
  if (t.from === 'CEK_MANUAL') await alertService.closeOpen(t.crossing_id, ['manual_check'], 'resolved');
  if (t.to === 'AMAN' || t.to === 'SIAGA') await alertService.closeOpen(t.crossing_id, ['train_detected', 'ack_overdue'], 'resolved');
}

let engine = null;
let ticker = null;
let deviceSync = null;

export function getEngine() {
  if (engine) return engine;
  engine = createEngine({
    config: loadMawConfig(),
    nodeMap: loadNodeMap(),
    hooks: {
      onReading: (r) => readingService.record(r),
      onTransition: async (t) => {
        await crossingService.syncStatus(t.crossing_id, {
          status: t.dashboard_status,
          train_detected: t.train_detected,
          ...(t.barrier_opened ? { barrier_status: 'open' } : {}),
        });
        await eventService.record({
          event_type: 'maw_state',
          severity: t.severity,
          crossing_id: t.crossing_id,
          title: `${LABEL[t.from]} → ${LABEL[t.to]}`,
          description: t.cause || (t.duration_s != null ? `Palang tertutup ${fmtDuration(t.duration_s)}` : `Status perlintasan ${LABEL[t.to]}`),
          metadata: { from: t.from, to: t.to, duration_s: t.duration_s, cause: t.cause, node_id: t.node_id, score: t.score },
        });
        await alertsFor(t);
      },
      onAcknowledge: async (a) => {
        await crossingService.syncStatus(a.crossing_id, { barrier_status: 'closed' });
        await alertService.closeOpen(a.crossing_id, ['train_detected'], 'acknowledged');
        await alertService.closeOpen(a.crossing_id, ['ack_overdue'], 'resolved');
        await eventService.record({
          event_type: 'maw_ack',
          severity: 'info',
          crossing_id: a.crossing_id,
          title: 'Palang dikonfirmasi tertutup',
          description: `Dikonfirmasi oleh ${a.by}${a.took_s != null ? ` dalam ${a.took_s} dtk` : ''}${a.overdue ? ' (terlambat)' : ''}`,
          metadata: { operator: a.operator, score: a.score, at: a.at, took_s: a.took_s, overdue: a.overdue },
        });
      },
      onScoreMismatch: async (m) => {
        await eventService.record({
          event_type: 'maw_score_mismatch',
          severity: 'warning',
          crossing_id: m.crossing_id,
          title: 'Skor tidak konsisten',
          description: `Skor node ${m.score_node}, hitung ulang ${m.score_calc}`,
          metadata: m,
        });
        await alertService.raise({
          crossing_id: m.crossing_id,
          device_id: m.device_id,
          alert_type: 'score_mismatch',
          severity: 'warning',
          title: 'Fusion Score Mismatch',
          message: `Node ${m.node_id} mengirim skor ${fmtScore(m.score_node)}, hitung ulang ${fmtScore(m.score_calc)}, periksa bobot di firmware`,
        });
      },
      onScoreMatch: (m) => alertService.closeOpen(m.crossing_id, ['score_mismatch'], 'resolved'),
      onDeviceChange: async (c) => {
        const { device } = c;
        if (c.to === 'disconnected') {
          await alertService.raise({
            crossing_id: c.crossing_id,
            device_id: device.id,
            alert_type: 'device_disconnected',
            severity: 'critical',
            title: 'Device Disconnected',
            message: `${device.name} terputus, data sensor tidak valid dan perlintasan masuk cek manual`,
          });
        } else {
          await alertService.closeOpen(c.crossing_id, ['device_disconnected'], 'resolved', device.id);
        }
        // Skip the event log on the first load (from: null) of a healthy device.
        if (c.from === null && c.to === 'connected') return;
        await eventService.record({
          event_type: 'device_status',
          severity: c.to === 'disconnected' ? 'critical' : 'info',
          crossing_id: c.crossing_id,
          title: `${device.name} ${c.to}`,
          description: c.to === 'disconnected' ? 'Perangkat terputus, perlintasan masuk cek manual' : 'Perangkat tersambung kembali',
          metadata: { device_id: device.id, from: c.from, to: c.to },
        });
      },
      onAckOverdue: async (o) => {
        await alertService.raise({
          crossing_id: o.crossing_id,
          device_id: o.device_id,
          alert_type: 'ack_overdue',
          severity: 'critical',
          title: 'Barrier Confirmation Overdue',
          message: `Palang belum dikonfirmasi tertutup dalam ${o.deadline_s} detik setelah kereta terdeteksi`,
        });
        await eventService.record({
          event_type: 'maw_ack_overdue',
          severity: 'critical',
          crossing_id: o.crossing_id,
          title: 'Konfirmasi palang terlambat',
          description: `Belum dikonfirmasi dalam ${o.deadline_s} dtk`,
          metadata: o,
        });
      },
    },
  });
  return engine;
}

// Push the registered devices' statuses (MongoDB `devices`) into the engine.
export async function refreshDevices() {
  const { data } = await deviceService.getAll();
  getEngine().setDeviceStatuses(
    data.filter((d) => d.kind === 'device').map((d) => ({ id: d.id, name: d.name || d.device_code || d.id, crossing_id: d.crossing_id, status: d.status })),
  );
}

export function startMaw() {
  const e = getEngine();
  if (!ticker) ticker = setInterval(() => e.tick(), 1000);
  if (!deviceSync) {
    const sync = () => refreshDevices().catch((err) => console.error('MAW device sync failed:', err.message));
    sync();
    deviceSync = setInterval(sync, 15_000); // also picks up status edits made directly in MongoDB
  }
  return e;
}

export function stopMaw() {
  if (ticker) clearInterval(ticker);
  if (deviceSync) clearInterval(deviceSync);
  ticker = null;
  deviceSync = null;
  engine?.stop();
}

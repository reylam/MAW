import { test } from 'node:test';
import assert from 'node:assert';
import { createEngine } from '../src/maw/engine.js';
import { DEFAULT_CONFIG, computeScore, validatePayload } from '../src/maw/mawState.js';

// Acceptance criteria from mobile/DESIGN.md bagian 12, on a fake clock.

const NODE_MAP = { SN_001: { crossing_id: 'JPL-112', crossing_name: 'JPL 112 · Ds. Sukamaju', posisi: 'Sisi barat, ±2 km' } };

function setup(nodeMap = NODE_MAP) {
  let t = 1_760_000_000_000;
  const engine = createEngine({ config: DEFAULT_CONFIG, nodeMap, now: () => t });
  const advance = (s) => { t += s * 1000; engine.tick(); };
  let seq = 0;
  // Payload whose recomputed score equals `score` (all sensors equal).
  const send = (score, extra = {}) => engine.ingest({
    node_id: 'SN_001',
    timestamp: Math.floor(t / 1000) + seq++,
    normalisasi: { v_norm: score, l_norm: score, m_norm: score, s_norm: score },
    fusion_score: score,
    status: 'SAFE',
    ...extra,
  });
  const state = (id = 'JPL-112') => engine.getState(id);
  return { engine, advance, send, state };
}

const EXAMPLE_81 = {
  node_id: 'SN_001',
  timestamp: 1728366420,
  data_mentah: { getaran_mpu6500: 6500, beban_hx711: 8500, magnet_hmc5883l: 420, suara_max9814: 512 },
  normalisasi: { v_norm: 0.85, l_norm: 0.9, m_norm: 0.65, s_norm: 0.4 },
  fusion_score: 0.83,
  status: 'DANGER',
};

test('payload 8.1 gives TUTUP, bar 0.76 and score mismatch', () => {
  const { engine, state } = setup();
  engine.ingest(EXAMPLE_81);
  const s = state();
  assert.strictEqual(s.state, 'TUTUP');
  assert.strictEqual(Math.round(s.fusion_score * 100) / 100, 0.76);
  assert.strictEqual(s.fusion_score_node, 0.83);
  assert.strictEqual(s.score_mismatch, true);
  assert.strictEqual(s.node.node_id, 'SN_001');
});

test('0.20 -> 0.50 -> 0.70 -> 0.30 runs AMAN, SIAGA, TUTUP, MENUNGGU_AMAN, AMAN without flicker', () => {
  const { send, advance, state } = setup();
  const seen = [];
  const note = () => { const s = state().state; if (seen.at(-1) !== s) seen.push(s); };
  send(0.2); note();
  advance(1); send(0.5); note();
  advance(1); send(0.7); note();
  advance(1); send(0.62); note();
  advance(1); send(0.55); note(); // around the threshold: still TUTUP
  advance(1); send(0.3); note();
  for (let i = 0; i < 19; i++) { advance(1); send(0.3); note(); }
  assert.strictEqual(state().state, 'MENUNGGU_AMAN');
  assert.ok(state().hold_remaining_s > 0);
  advance(1); send(0.3); note();
  assert.deepStrictEqual(seen, ['AMAN', 'SIAGA', 'TUTUP', 'MENUNGGU_AMAN', 'AMAN']);
});

test('score rising again during MENUNGGU_AMAN returns to TUTUP and resets the timer', () => {
  const { send, advance, state } = setup();
  send(0.7);
  advance(1); send(0.2);
  advance(10); send(0.2);
  assert.strictEqual(state().state, 'MENUNGGU_AMAN');
  advance(1); send(0.45);
  assert.strictEqual(state().state, 'TUTUP');
  advance(1); send(0.2);
  assert.strictEqual(state().hold_remaining_s, 20);
});

test('DANGER with low recomputed score still gives TUTUP', () => {
  const { send, state } = setup();
  send(0.3, { status: 'DANGER' });
  assert.strictEqual(state().state, 'TUTUP');
});

test('non-DANGER status cannot cancel TUTUP while effective score >= T_TUTUP (R5)', () => {
  const { send, state } = setup();
  send(0.5, { fusion_score: 0.7, status: 'SAFE' });
  assert.strictEqual(state().state, 'TUTUP');
});

test('unknown node_id does not change the display', () => {
  const { engine, send, state } = setup();
  send(0.2);
  const res = engine.ingest({ ...EXAMPLE_81, node_id: 'SN_999' });
  assert.strictEqual(res.reason, 'unknown_node');
  assert.strictEqual(state().state, 'AMAN');
});

test('AMAN never shows with data older than STALE_MAX', () => {
  const { send, advance, state } = setup();
  send(0.1);
  advance(15);
  assert.strictEqual(state().state, 'AMAN');
  advance(1);
  assert.strictEqual(state().state, 'CEK_MANUAL');
  assert.match(state().cause, /SN_001 tidak mengirim data/);
});

test('recovering from CEK_MANUAL after a closure goes to MENUNGGU_AMAN, not AMAN', () => {
  const { send, advance, state } = setup();
  send(0.7);
  advance(20);
  assert.strictEqual(state().state, 'CEK_MANUAL');
  send(0.1);
  assert.strictEqual(state().state, 'MENUNGGU_AMAN');
  assert.strictEqual(state().hold_remaining_s, 20);
});

test('broker disconnect forces CEK_MANUAL immediately', () => {
  const { engine, send, state } = setup();
  send(0.1);
  engine.setLinkFault('Koneksi broker terputus');
  assert.strictEqual(state().state, 'CEK_MANUAL');
  assert.strictEqual(state().cause, 'Koneksi broker terputus');
});

test('missing primary sensor (getaran) forces CEK_MANUAL; missing secondary only warns', () => {
  const { send, state } = setup();
  send(0.1, { normalisasi: { v_norm: 0.1, l_norm: 0.1, m_norm: 0.1 } });
  assert.strictEqual(state().state, 'AMAN');
  assert.deepStrictEqual(state().warnings, ['Sensor suara tidak terbaca']);
  send(0.1, { normalisasi: { l_norm: 0.1, m_norm: 0.1, s_norm: 0.1 } });
  assert.strictEqual(state().state, 'CEK_MANUAL');
});

test('duplicate messages within 2 s are ignored; out-of-range values are clamped', () => {
  const { engine } = setup();
  const msg = { ...EXAMPLE_81, normalisasi: { ...EXAMPLE_81.normalisasi, v_norm: 1.4 } };
  assert.strictEqual(engine.ingest(msg).accepted, true);
  assert.strictEqual(engine.ingest(msg).reason, 'duplicate');
  const v = validatePayload(msg);
  assert.strictEqual(v.message.normalisasi.v_norm, 1);
  assert.ok(v.warnings.some((w) => w.code === 'sensor_out_of_range'));
});

test('invalid JSON is dropped', () => {
  const { engine } = setup();
  assert.strictEqual(engine.ingest(Buffer.from('{not json')).reason, 'invalid_payload');
});

test('acknowledge only in TUTUP, cleared after AMAN', () => {
  const { engine, send, advance, state } = setup();
  send(0.1);
  assert.ok(engine.acknowledge('JPL-112', { name: 'Budi', email: 'budi@maw.id' }).conflict);
  send(0.8);
  engine.acknowledge('JPL-112', { name: 'Budi', email: 'budi@maw.id' });
  assert.strictEqual(state().acknowledged.by, 'Budi');
  advance(1); send(0.1);
  for (let i = 0; i < 21; i++) { advance(1); send(0.1); }
  assert.strictEqual(state().state, 'AMAN');
  assert.strictEqual(state().acknowledged, null);
});

test('TUTUP not confirmed within CLOSE_DEADLINE_S escalates once; confirmation closes the barrier', () => {
  const overdue = [];
  let t = 1_760_000_000_000;
  const engine = createEngine({ config: DEFAULT_CONFIG, nodeMap: NODE_MAP, now: () => t, hooks: { onAckOverdue: (o) => overdue.push(o) } });
  const send = (score) => engine.ingest({ node_id: 'SN_001', timestamp: t / 1000, normalisasi: { v_norm: score, l_norm: score, m_norm: score, s_norm: score }, fusion_score: score, status: score >= 0.6 ? 'DANGER' : 'SAFE' });
  const state = () => engine.getState('JPL-112');

  send(0.9);
  assert.strictEqual(state().barrier_status, 'open');
  assert.strictEqual(new Date(state().close_deadline_at).getTime() - t, 20_000);
  for (let i = 0; i < 19; i++) { t += 1000; send(0.9); engine.tick(); }
  assert.strictEqual(state().ack_overdue, false);
  t += 1000; send(0.9); engine.tick();
  t += 1000; send(0.9); engine.tick();
  return new Promise((r) => setTimeout(r, 0)).then(() => {
    assert.strictEqual(overdue.length, 1);
    assert.strictEqual(state().ack_overdue, true);
    engine.acknowledge('JPL-112', { name: 'Budi', email: 'budi@maw.id' });
    assert.strictEqual(state().barrier_status, 'closed');
    assert.strictEqual(state().close_deadline_at, null);
    assert.strictEqual(state().acknowledged.took_s, 21);
  });
});

test('a disconnected device forces CEK_MANUAL until it reconnects', async () => {
  const changes = [];
  let t = 1_760_000_000_000;
  const engine = createEngine({ config: DEFAULT_CONFIG, nodeMap: NODE_MAP, now: () => t, hooks: { onDeviceChange: (c) => changes.push(`${c.device.name}:${c.from}>${c.to}`) } });
  const send = (score) => engine.ingest({ node_id: 'SN_001', timestamp: t / 1000, normalisasi: { v_norm: score, l_norm: score, m_norm: score, s_norm: score }, fusion_score: score, status: 'SAFE' });
  const state = () => engine.getState('JPL-112');
  const devices = (mpu) => [
    { id: 'esp', name: 'ESP32', crossing_id: 'JPL-112', status: 'connected' },
    { id: 'mpu', name: 'MPU6500', crossing_id: 'JPL-112', status: mpu },
  ];

  send(0.1);
  engine.setDeviceStatuses(devices('connected'));
  assert.strictEqual(state().state, 'AMAN');
  assert.deepStrictEqual(state().device_faults, []);

  engine.setDeviceStatuses(devices('disconnected'));
  assert.strictEqual(state().state, 'CEK_MANUAL');
  assert.strictEqual(state().cause, 'Perangkat terputus: MPU6500');
  assert.deepStrictEqual(state().device_faults, ['MPU6500']);

  // Fresh sensor data does not hide a disconnected device.
  t += 1000; send(0.1);
  assert.strictEqual(state().state, 'CEK_MANUAL');

  engine.setDeviceStatuses(devices('connected'));
  assert.strictEqual(state().state, 'AMAN');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepStrictEqual(changes, ['ESP32:null>connected', 'MPU6500:null>connected', 'MPU6500:connected>disconnected', 'MPU6500:disconnected>connected']);
});

test('after a closure, a device fault recovers to MENUNGGU_AMAN, not AMAN', () => {
  const { engine, send, advance, state } = setup();
  send(0.9);
  engine.setDeviceStatuses([{ id: 'mpu', name: 'MPU6500', crossing_id: 'JPL-112', status: 'disconnected' }]);
  assert.strictEqual(state().state, 'CEK_MANUAL');
  send(0.1);
  engine.setDeviceStatuses([{ id: 'mpu', name: 'MPU6500', crossing_id: 'JPL-112', status: 'connected' }]);
  assert.strictEqual(state().state, 'MENUNGGU_AMAN');
  advance(1);
});

test('acknowledge is also allowed in MENUNGGU_AMAN', () => {
  const { engine, send, advance, state } = setup();
  send(0.9);
  advance(1); send(0.1);
  assert.strictEqual(state().state, 'MENUNGGU_AMAN');
  assert.ok(engine.acknowledge('JPL-112', { name: 'Budi', email: 'budi@maw.id' }).data);
  assert.strictEqual(state().barrier_status, 'closed');
});

test('crossing takes the worst state of its nodes (R7)', () => {
  const map = { ...NODE_MAP, SN_002: { crossing_id: 'JPL-112', crossing_name: 'JPL 112 · Ds. Sukamaju' } };
  const { engine, send, state } = setup(map);
  send(0.1);
  assert.strictEqual(state().state, 'CEK_MANUAL'); // SN_002 never reported
  engine.ingest({ node_id: 'SN_002', timestamp: 1, normalisasi: { v_norm: 0.9, l_norm: 0.9, m_norm: 0.9, s_norm: 0.9 }, fusion_score: 0.9, status: 'DANGER' });
  assert.strictEqual(state().state, 'TUTUP');
});

// Real payloads captured from the SN_001 firmware (S4 safe, S5 warning, S3 danger).
const FIRMWARE = {
  S4: { node_id: 'SN_001', timestamp: 1792419342, data_mentah: { getaran_mpu6500: 665, beban_hx711: 384, magnet_hmc5883l: 195, suara_max9814: 218 }, normalisasi: { v_norm: 0.05, l_norm: 0.02, m_norm: 0.04, s_norm: 0.1 }, fusion_score: 0.05, status: 'SAFE' },
  S5: { node_id: 'SN_001', timestamp: 1792419342, data_mentah: { getaran_mpu6500: 5410, beban_hx711: 2505, magnet_hmc5883l: 346, suara_max9814: 659 }, normalisasi: { v_norm: 0.7, l_norm: 0.25, m_norm: 0.45, s_norm: 0.55 }, fusion_score: 0.49, status: 'WARNING' },
  S3: { node_id: 'SN_001', timestamp: 1792419342, data_mentah: { getaran_mpu6500: 7308, beban_hx711: 8867, magnet_hmc5883l: 517, suara_max9814: 1022 }, normalisasi: { v_norm: 0.96, l_norm: 0.94, m_norm: 0.91, s_norm: 0.92 }, fusion_score: 0.94, status: 'DANGER' },
};

test('firmware payloads S4/S5/S3 give AMAN, SIAGA, TUTUP with consistent scores', () => {
  const { engine, advance, state } = setup();
  for (const [name, expected] of [['S4', 'AMAN'], ['S5', 'SIAGA'], ['S3', 'TUTUP']]) {
    const res = engine.ingest(FIRMWARE[name]);
    assert.strictEqual(res.accepted, true, name);
    assert.strictEqual(state().state, expected, name);
    assert.strictEqual(state().score_mismatch, false, name);
    assert.deepStrictEqual(res.warnings, [], name);
    advance(1);
  }
});

test('WARNING from the node never shows AMAN, even with a low score (R5b)', () => {
  const { send, state } = setup();
  send(0.1, { status: 'WARNING' });
  assert.strictEqual(state().state, 'SIAGA');
});

test('WARNING during MENUNGGU_AMAN keeps the barrier closed and resets the timer', () => {
  const { send, advance, state } = setup();
  send(0.8, { status: 'DANGER' });
  advance(1); send(0.1);
  advance(5); send(0.1);
  assert.strictEqual(state().state, 'MENUNGGU_AMAN');
  advance(1); send(0.1, { status: 'WARNING' });
  assert.strictEqual(state().state, 'TUTUP');
});

test('unknown status value is accepted but flagged', () => {
  const v = validatePayload({ ...FIRMWARE.S4, status: 'OK' });
  assert.ok(v.warnings.some((w) => w.code === 'unknown_status'));
});

test('computeScore uses agreed weights', () => {
  const r = computeScore(validatePayload(EXAMPLE_81).message);
  assert.strictEqual(r.score_calc, 0.7575);
  assert.strictEqual(r.score_effective, 0.83);
});

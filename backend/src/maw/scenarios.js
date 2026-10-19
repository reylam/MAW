import { readFileSync } from 'node:fs';

/*
  Test scenarios shared by the CLI simulator (npm run s3/s4/s5/train) and the
  web Simulation Center. Firmware payloads live in scripts/scenarios.json; add
  a scenario by pasting a payload there under a new key.
*/

const W = { v_norm: 0.35, l_norm: 0.3, m_norm: 0.2, s_norm: 0.15 };
const round = (v) => Math.round(v * 100) / 100;

// One score per heartbeat for a passing train (about 75 s per cycle).
export const TRAIN = [0.1, 0.1, 0.45, 0.55, 0.72, 0.85, 0.8, 0.62, 0.3, 0.15, 0.1, 0.1, 0.1, 0.1, 0.1];

export function trainPayload(score, nodeId = 'SN_001') {
  const normalisasi = { v_norm: score, l_norm: score, m_norm: round(score * 0.9), s_norm: round(score * 0.8) };
  const fusion = round(Object.entries(W).reduce((a, [k, w]) => a + normalisasi[k] * w, 0));
  return {
    node_id: nodeId,
    data_mentah: {
      getaran_mpu6500: Math.round(score * 7600),
      beban_hx711: Math.round(score * 9400),
      magnet_hmc5883l: Math.round(score * 640),
      suara_max9814: Math.round(score * 1023),
    },
    normalisasi,
    fusion_score: fusion,
    status: fusion >= 0.6 ? 'DANGER' : fusion >= 0.4 ? 'WARNING' : 'SAFE',
  };
}

export function loadScenarios() {
  const file = JSON.parse(readFileSync(new URL('../../scripts/scenarios.json', import.meta.url), 'utf8'));
  return {
    ...file,
    train: { label: 'Kereta lewat (AMAN → SIAGA → TUTUP → MENUNGGU AMAN → AMAN)', payload: null },
  };
}

// Payload for step `seq` of a scenario, with a fresh timestamp.
export function scenarioPayload(scenarios, name, seq) {
  const base = name === 'train' ? trainPayload(TRAIN[seq % TRAIN.length]) : scenarios[name].payload;
  return { ...base, timestamp: Math.floor(Date.now() / 1000) };
}

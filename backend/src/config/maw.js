import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG } from '../maw/mawState.js';

/*
  Field-calibrated parameters for the MAW decision engine (DESIGN.md 3.1).
  Defaults come from mawState.js; every value can be overridden via env so
  T_TUTUP can be kept equal to the ESP32 firmware threshold without code changes.

  Node -> crossing mapping (8.5) is read from MAW_NODE_MAP (inline JSON) or
  from src/config/nodeMap.json.
*/

const num = (name, fallback) => {
  const v = Number(process.env[name]);
  return process.env[name] !== undefined && process.env[name] !== '' && Number.isFinite(v) ? v : fallback;
};

export function loadMawConfig() {
  const d = DEFAULT_CONFIG;
  return {
    weights: {
      v_norm: num('MAW_W_GETARAN', d.weights.v_norm),
      l_norm: num('MAW_W_BEBAN', d.weights.l_norm),
      m_norm: num('MAW_W_MAGNET', d.weights.m_norm),
      s_norm: num('MAW_W_SUARA', d.weights.s_norm),
    },
    T_TUTUP: num('MAW_T_TUTUP', d.T_TUTUP),
    T_SIAGA: num('MAW_T_SIAGA', d.T_SIAGA),
    HOLD_BUKA_S: num('MAW_HOLD_BUKA_S', d.HOLD_BUKA_S),
    STALE_MAX_S: num('MAW_STALE_MAX_S', d.STALE_MAX_S),
    HEARTBEAT_S: num('MAW_HEARTBEAT_S', d.HEARTBEAT_S),
    SCORE_TOL: num('MAW_SCORE_TOL', d.SCORE_TOL),
    CLOSE_DEADLINE_S: num('MAW_CLOSE_DEADLINE_S', d.CLOSE_DEADLINE_S),
    DEDUP_S: d.DEDUP_S,
    CLOCK_SKEW_S: d.CLOCK_SKEW_S,
  };
}

export function loadNodeMap() {
  const raw = process.env.MAW_NODE_MAP || readFileSync(new URL('./nodeMap.json', import.meta.url), 'utf8');
  return JSON.parse(raw);
}

export function mawNodeTopic() {
  return process.env.MAW_NODE_TOPIC || 'mqx/node/data';
}

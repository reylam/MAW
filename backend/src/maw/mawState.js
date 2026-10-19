/*
  MAW decision logic (DESIGN.md bagian 3 dan 8.2-8.4).

  Pure module with no imports and no I/O, so the same file can run in the
  backend and, if needed, in a client (prototype mode 8.7). All times are
  milliseconds since epoch and are passed in explicitly.
*/

export const STATES = ['AMAN', 'SIAGA', 'TUTUP', 'MENUNGGU_AMAN', 'CEK_MANUAL'];

// Worst first (R7).
const SEVERITY = { CEK_MANUAL: 4, TUTUP: 3, MENUNGGU_AMAN: 2, SIAGA: 1, AMAN: 0 };

export const SENSORS = [
  { field: 'v_norm', sensor: 'Getaran', hardware: 'MPU6500', primary: true },
  { field: 'l_norm', sensor: 'Beban', hardware: 'Load Cell HX711' },
  { field: 'm_norm', sensor: 'Magnet', hardware: 'HMC5883L' },
  { field: 's_norm', sensor: 'Suara', hardware: 'MAX9814' },
];

export const DEFAULT_CONFIG = {
  weights: { v_norm: 0.35, l_norm: 0.3, m_norm: 0.2, s_norm: 0.15 },
  T_TUTUP: 0.6,
  T_SIAGA: 0.4,
  HOLD_BUKA_S: 20,
  STALE_MAX_S: 15,
  HEARTBEAT_S: 5,
  SCORE_TOL: 0.02,
  DEDUP_S: 2,
  CLOCK_SKEW_S: 60,
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const round = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/*
  8.2 langkah 1-4. `raw` may be a string, Buffer or object.
  Returns { ok: false, reason } when the message must be dropped, otherwise
  { ok: true, message, warnings } where message has clamped values.
*/
export function validatePayload(raw, knownNodes = null) {
  let p = raw;
  if (raw instanceof Uint8Array) p = new TextDecoder().decode(raw); // Buffer in Node
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch { return { ok: false, reason: 'invalid_payload' }; }
  }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, reason: 'invalid_payload' };
  if (typeof p.node_id !== 'string' || !p.node_id) return { ok: false, reason: 'invalid_payload' };
  if (knownNodes && !knownNodes.has(p.node_id)) return { ok: false, reason: 'unknown_node' };

  const warnings = [];
  const norm = p.normalisasi && typeof p.normalisasi === 'object' ? p.normalisasi : {};
  const normalisasi = {};
  const missing = [];
  for (const { field } of SENSORS) {
    const v = norm[field];
    if (!isNum(v)) { normalisasi[field] = null; missing.push(field); continue; }
    if (v < 0 || v > 1) warnings.push({ code: 'sensor_out_of_range', field, value: v });
    normalisasi[field] = clamp01(v);
  }

  let fusion = null;
  if (isNum(p.fusion_score)) {
    if (p.fusion_score < 0 || p.fusion_score > 1) warnings.push({ code: 'sensor_out_of_range', field: 'fusion_score', value: p.fusion_score });
    fusion = clamp01(p.fusion_score);
  }

  const incomplete = missing.length > 0 || fusion === null || typeof p.status !== 'string';
  if (incomplete) warnings.push({ code: 'incomplete_payload', missing: [...missing, ...(fusion === null ? ['fusion_score'] : []), ...(typeof p.status !== 'string' ? ['status'] : [])] });

  return {
    ok: true,
    warnings,
    message: {
      node_id: p.node_id,
      timestamp: isNum(p.timestamp) ? p.timestamp : null,
      data_mentah: p.data_mentah && typeof p.data_mentah === 'object' ? p.data_mentah : null,
      normalisasi,
      missing,
      primary_missing: missing.includes('v_norm'),
      fusion_score: fusion,
      danger: p.status === 'DANGER',
      status: typeof p.status === 'string' ? p.status : null,
      seq: isNum(p.seq) ? p.seq : null,
    },
  };
}

// 8.3: recompute, effective score and mismatch. Missing sensors count as 0.
export function computeScore(message, config = DEFAULT_CONFIG) {
  const contributions = SENSORS.map(({ field, sensor }) => {
    const value = message.normalisasi[field];
    const weight = config.weights[field];
    return { sensor, field, value, weight, result: value == null ? null : round(value * weight) };
  });
  const calc = round(contributions.reduce((a, c) => a + (c.result ?? 0), 0));
  const node = message.fusion_score;
  const effective = node == null ? calc : Math.max(node, calc);
  const diff = node == null ? 0 : Math.abs(node - calc);
  return {
    score_calc: calc,
    score_node: node,
    score_effective: round(effective),
    score_mismatch: diff > config.SCORE_TOL + 1e-9,
    score_diff: round(diff),
    contributions,
  };
}

export function createNodeState(nodeId) {
  return {
    node_id: nodeId,
    state: 'CEK_MANUAL',
    cause: `Belum ada data dari node ${nodeId}`,
    last: null,
    hold_started_at: null,
    entered_at: null,
    closed_since: null, // start of the current TUTUP episode, for duration logging
    latched_before_fault: false,
  };
}

// Record a validated message on the node (does not change state by itself).
export function recordMessage(ns, message, receivedAt, config = DEFAULT_CONFIG) {
  ns.last = { ...message, ...computeScore(message, config), received_at: receivedAt };
  return ns;
}

/*
  Section 3 state machine. Call after every message and on a timer (for
  STALE_MAX and HOLD_BUKA). Returns the same object, mutated, plus the
  previous state so callers can detect transitions.
*/
export function evaluateNode(ns, now, config = DEFAULT_CONFIG, externalFault = null) {
  const prev = ns.state;
  const latchedPrev = prev === 'TUTUP' || prev === 'MENUNGGU_AMAN';
  const last = ns.last;

  const fault = (cause) => {
    if (prev !== 'CEK_MANUAL') ns.latched_before_fault = latchedPrev;
    ns.state = 'CEK_MANUAL';
    ns.cause = cause;
    ns.hold_started_at = null;
  };

  if (externalFault) {
    fault(externalFault);
  } else if (!last) {
    fault(`Belum ada data dari node ${ns.node_id}`);
  } else if (now - last.received_at > config.STALE_MAX_S * 1000) {
    fault(`Node ${ns.node_id} tidak mengirim data`);
  } else if (last.primary_missing) {
    fault('Sensor getaran tidak terbaca');
  } else {
    let base = prev;
    let holdFrom = last.received_at;
    if (prev === 'CEK_MANUAL') {
      // Recovering: never jump straight to AMAN after a closure (3.3).
      base = ns.latched_before_fault ? 'MENUNGGU_AMAN' : null;
      holdFrom = now;
      ns.hold_started_at = null;
      ns.latched_before_fault = false;
    }

    const score = last.score_effective;
    const closing = score >= config.T_TUTUP || last.danger;
    let next;
    if (closing) {
      next = 'TUTUP';
      ns.hold_started_at = null;
    } else if (base === 'TUTUP' || base === 'MENUNGGU_AMAN') {
      if (score >= config.T_SIAGA) {
        next = 'TUTUP'; // R1/R2: still latched, timer reset
        ns.hold_started_at = null;
      } else {
        if (ns.hold_started_at == null) ns.hold_started_at = holdFrom;
        next = now - ns.hold_started_at >= config.HOLD_BUKA_S * 1000 ? 'AMAN' : 'MENUNGGU_AMAN';
        if (next === 'AMAN') ns.hold_started_at = null;
      }
    } else {
      next = score >= config.T_SIAGA ? 'SIAGA' : 'AMAN';
      ns.hold_started_at = null;
    }
    ns.state = next;
    ns.cause = null;
  }

  if (ns.state !== prev) {
    ns.entered_at = now;
    if (ns.state === 'TUTUP' && !(prev === 'MENUNGGU_AMAN' || (prev === 'CEK_MANUAL' && ns.closed_since))) ns.closed_since = now;
    if (ns.state === 'AMAN' || ns.state === 'SIAGA') {
      ns.closure_ms = ns.closed_since != null ? now - ns.closed_since : null;
      ns.closed_since = null;
    }
  }
  return { ns, prev, changed: ns.state !== prev };
}

export function holdRemaining(ns, now, config = DEFAULT_CONFIG) {
  if (ns.state !== 'MENUNGGU_AMAN' || ns.hold_started_at == null) return null;
  return Math.max(0, Math.ceil((config.HOLD_BUKA_S * 1000 - (now - ns.hold_started_at)) / 1000));
}

export function worstState(states) {
  return states.reduce((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst), 'AMAN');
}

export function severity(state) {
  return SEVERITY[state] ?? 0;
}

export const REASONS = {
  AMAN: 'Tidak ada kereta terdeteksi',
  SIAGA: 'Sinyal kereta mulai terbaca',
  TUTUP: 'Kereta terdeteksi mendekat',
  MENUNGGU_AMAN: 'Kereta menjauh',
};

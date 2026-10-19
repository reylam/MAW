import {
  validatePayload, recordMessage, evaluateNode, createNodeState, holdRemaining,
  worstState, severity, REASONS,
} from './mawState.js';

/*
  Stateful MAW engine: owns per-node state, derives per-crossing state (R7),
  logs transitions, and notifies listeners (WebSocket) with `crossing.state`
  payloads (DESIGN.md 8.6).

  Side effects (persistence, event log, crossing status sync) are injected via
  `hooks` so the engine can be unit-tested without MongoDB.
*/

const BROADCAST_MIN_MS = 500; // max 2 messages/s per crossing

// Crossing state -> legacy dashboard status used by the web frontend.
const DASHBOARD_STATUS = { AMAN: 'safe', SIAGA: 'warning', TUTUP: 'critical', MENUNGGU_AMAN: 'critical', CEK_MANUAL: 'offline' };
const EVENT_SEVERITY = { AMAN: 'info', SIAGA: 'warning', TUTUP: 'critical', MENUNGGU_AMAN: 'warning', CEK_MANUAL: 'critical' };
const SENSOR_LABEL = { v_norm: 'getaran', l_norm: 'beban', m_norm: 'magnet', s_norm: 'suara' };

export function createEngine({ config, nodeMap, now = () => Date.now(), hooks = {} }) {
  const knownNodes = new Set(Object.keys(nodeMap));
  const nodes = new Map(); // node_id -> node state
  const crossings = new Map(); // crossing_id -> { id, name, node_ids, state, last_known_state, ack, entered_at }
  const listeners = new Set();
  const lastSent = new Map();
  const pending = new Map();
  const recent = new Map(); // dedup key -> received_at
  let linkFault = null; // e.g. MQTT broker down: every node is CEK_MANUAL immediately
  // Registered devices per crossing (collection `devices`). Any disconnected one forces CEK_MANUAL.
  const deviceStates = new Map(); // crossing_id -> [{ id, name, status }]
  const isDown = (status) => ['disconnected', 'offline'].includes(String(status).toLowerCase());
  const downDevices = (crossingId) => (deviceStates.get(crossingId) || []).filter((d) => isDown(d.status));
  function faultFor(nodeId) {
    if (linkFault) return linkFault;
    const down = downDevices(nodeMap[nodeId].crossing_id);
    return down.length ? `Perangkat terputus: ${down.map((d) => d.name).join(', ')}` : null;
  }
  function tickAll() {
    const t = now();
    for (const ns of nodes.values()) evaluateNode(ns, t, config, faultFor(ns.node_id));
    for (const c of crossings.values()) updateCrossing(c, { force: true });
  }
  const counters = { received: 0, accepted: 0, invalid_payload: 0, unknown_node: 0, duplicate: 0, sensor_out_of_range: 0, incomplete_payload: 0, unknown_status: 0, score_mismatch: 0, clock_skew: 0 };

  for (const [nodeId, info] of Object.entries(nodeMap)) {
    nodes.set(nodeId, createNodeState(nodeId));
    const c = crossings.get(info.crossing_id) || {
      id: info.crossing_id,
      name: info.crossing_name || info.crossing_id,
      node_ids: [],
      state: 'CEK_MANUAL',
      last_known_state: null,
      ack: null,
      entered_at: now(),
      closure_started_at: null, // first TUTUP of the current closure episode
      overdue_notified: false,
    };
    c.node_ids.push(nodeId);
    crossings.set(info.crossing_id, c);
  }

  const call = (name, ...args) => {
    const fn = hooks[name];
    if (!fn) return;
    Promise.resolve()
      .then(() => fn(...args))
      .catch((e) => console.error(`MAW hook ${name} failed:`, e.message));
  };

  // The node that decides the crossing state: worst state, then highest score.
  function decidingNode(c) {
    return c.node_ids
      .map((id) => nodes.get(id))
      .sort((a, b) => severity(b.state) - severity(a.state) || (b.last?.score_effective ?? -1) - (a.last?.score_effective ?? -1))[0];
  }

  function view(c) {
    const t = now();
    const ns = decidingNode(c);
    const last = ns.last;
    const info = nodeMap[ns.node_id] || {};
    const missingSecondary = last ? last.missing.filter((f) => f !== 'v_norm') : [];
    return {
      crossing_id: c.id,
      crossing_name: c.name,
      state: c.state,
      reason: c.state === 'CEK_MANUAL' ? ns.cause : REASONS[c.state],
      cause: c.state === 'CEK_MANUAL' ? ns.cause : null,
      last_known_state: c.last_known_state,
      fusion_score: last?.score_calc ?? null,
      fusion_score_node: last?.score_node ?? null,
      fusion_score_effective: last?.score_effective ?? null,
      score_mismatch: Boolean(last?.score_mismatch),
      thresholds: { siaga: config.T_SIAGA, tutup: config.T_TUTUP },
      weights: config.weights,
      hold_buka_s: config.HOLD_BUKA_S,
      stale_max_s: config.STALE_MAX_S,
      contributions: last?.contributions ?? null,
      node: { node_id: ns.node_id, device_id: info.device_id ?? null, status: last?.status ?? null, posisi: info.posisi ?? null },
      nodes: c.node_ids.map((id) => ({ node_id: id, state: nodes.get(id).state })),
      warnings: missingSecondary.map((f) => `Sensor ${SENSOR_LABEL[f]} tidak terbaca`),
      devices: deviceStates.get(c.id) || [],
      device_faults: downDevices(c.id).map((d) => d.name),
      hold_remaining_s: holdRemaining(ns, t, config),
      received_at: last ? new Date(last.received_at).toISOString() : null,
      server_ts: new Date(t).toISOString(),
      acknowledged: c.ack,
      entered_at: new Date(c.entered_at).toISOString(),
      // Barrier: closed once the petugas confirms, open again when the crossing is safe.
      barrier_status: c.ack ? 'closed' : 'open',
      close_deadline_s: config.CLOSE_DEADLINE_S,
      close_deadline_at: c.closure_started_at != null && !c.ack
        ? new Date(c.closure_started_at + config.CLOSE_DEADLINE_S * 1000).toISOString()
        : null,
      ack_overdue: c.overdue_notified && !c.ack,
    };
  }

  function emit(c, force = false) {
    const t = now();
    const since = t - (lastSent.get(c.id) || 0);
    if (!force && since < BROADCAST_MIN_MS) {
      if (!pending.has(c.id)) {
        pending.set(c.id, setTimeout(() => { pending.delete(c.id); emit(c, true); }, BROADCAST_MIN_MS - since));
      }
      return;
    }
    lastSent.set(c.id, t);
    const payload = view(c);
    for (const fn of listeners) fn(payload);
  }

  function updateCrossing(c, { force = false } = {}) {
    const t = now();
    const prev = c.state;
    const next = worstState(c.node_ids.map((id) => nodes.get(id).state));
    if (next !== prev) {
      c.state = next;
      if (prev !== 'CEK_MANUAL') c.last_known_state = prev;
      const ns = decidingNode(c);
      const leftClosure = (prev === 'MENUNGGU_AMAN' || prev === 'TUTUP') && (next === 'AMAN' || next === 'SIAGA');
      const durationS = leftClosure && ns.closure_ms != null ? Math.round(ns.closure_ms / 1000) : null;
      const wasClosed = Boolean(c.ack);
      if (next === 'TUTUP' && c.closure_started_at == null) c.closure_started_at = t;
      if (next === 'AMAN' || next === 'SIAGA') {
        c.ack = null;
        c.closure_started_at = null;
        c.overdue_notified = false;
      }
      c.entered_at = t;
      call('onTransition', {
        crossing_id: c.id,
        crossing_name: c.name,
        from: prev,
        to: next,
        duration_s: durationS,
        cause: next === 'CEK_MANUAL' ? ns.cause : null,
        node_id: ns.node_id,
        score: ns.last?.score_effective ?? null,
        severity: EVENT_SEVERITY[next],
        dashboard_status: DASHBOARD_STATUS[next],
        train_detected: next === 'TUTUP' || next === 'MENUNGGU_AMAN',
        barrier_opened: wasClosed && !c.ack,
        device_id: nodeMap[ns.node_id]?.device_id ?? null,
      });
      emit(c, true);
      return;
    }
    checkDeadline(c, t);
    emit(c, force);
  }

  // Escalate once when TUTUP is not confirmed within CLOSE_DEADLINE_S.
  function checkDeadline(c, t) {
    if (c.state !== 'TUTUP' || c.ack || c.overdue_notified || c.closure_started_at == null) return;
    if (t - c.closure_started_at < config.CLOSE_DEADLINE_S * 1000) return;
    c.overdue_notified = true;
    const ns = decidingNode(c);
    call('onAckOverdue', {
      crossing_id: c.id,
      crossing_name: c.name,
      node_id: ns.node_id,
      device_id: nodeMap[ns.node_id]?.device_id ?? null,
      deadline_s: config.CLOSE_DEADLINE_S,
      score: ns.last?.score_effective ?? null,
    });
  }

  function crossingOf(nodeId) {
    return crossings.get(nodeMap[nodeId].crossing_id);
  }

  return {
    config,

    // 8.2: validate, dedup, record, evaluate. Returns a summary for callers/tests.
    ingest(raw, { source = 'mqtt' } = {}) {
      counters.received++;
      const t = now();
      const res = validatePayload(raw, knownNodes);
      if (!res.ok) {
        counters[res.reason]++;
        console.warn(`MAW: dropped message (${res.reason})`);
        return { accepted: false, reason: res.reason };
      }
      const msg = res.message;

      const key = `${msg.node_id}|${msg.timestamp}|${msg.fusion_score}`;
      for (const [k, at] of recent) if (t - at > config.DEDUP_S * 1000) recent.delete(k);
      if (recent.has(key)) {
        counters.duplicate++;
        return { accepted: false, reason: 'duplicate' };
      }
      recent.set(key, t);

      for (const w of res.warnings) counters[w.code]++;
      if (msg.timestamp != null && Math.abs(msg.timestamp * 1000 - t) > config.CLOCK_SKEW_S * 1000) {
        counters.clock_skew++;
        console.warn(`MAW: jam node ${msg.node_id} tidak sinkron (timestamp ${msg.timestamp})`);
      }

      const ns = nodes.get(msg.node_id);
      const wasMismatch = Boolean(ns.last?.score_mismatch);
      recordMessage(ns, msg, t, config);
      counters.accepted++;
      if (ns.last.score_mismatch) counters.score_mismatch++;

      const c = crossingOf(msg.node_id);
      if (ns.last.score_mismatch && !wasMismatch) {
        call('onScoreMismatch', {
          crossing_id: c.id,
          crossing_name: c.name,
          node_id: msg.node_id,
          device_id: nodeMap[msg.node_id]?.device_id ?? null,
          score_node: ns.last.score_node,
          score_calc: ns.last.score_calc,
        });
      } else if (!ns.last.score_mismatch && wasMismatch) {
        call('onScoreMatch', { crossing_id: c.id, node_id: msg.node_id });
      }
      call('onReading', { ...ns.last, crossing_id: c.id, source, warnings: res.warnings });

      evaluateNode(ns, t, config, faultFor(ns.node_id));
      updateCrossing(c);
      return { accepted: true, node_state: ns.state, crossing_state: c.state, warnings: res.warnings };
    },

    // Timer: STALE_MAX and HOLD_BUKA are time based, not message based.
    tick: tickAll,

    // Latest status of the registered devices (from MongoDB / MQTT). Calls
    // hooks.onDeviceChange for every device whose status changed (first load included).
    setDeviceStatuses(list) {
      const next = new Map();
      for (const d of list) {
        if (!crossings.has(d.crossing_id)) continue;
        if (!next.has(d.crossing_id)) next.set(d.crossing_id, []);
        next.get(d.crossing_id).push({ id: d.id, name: d.name, status: isDown(d.status) ? 'disconnected' : 'connected' });
      }
      for (const [crossingId, devices] of next) {
        const before = new Map((deviceStates.get(crossingId) || []).map((d) => [d.id, d.status]));
        for (const d of devices) {
          if (before.get(d.id) === d.status) continue;
          call('onDeviceChange', { crossing_id: crossingId, crossing_name: crossings.get(crossingId).name, device: d, from: before.get(d.id) ?? null, to: d.status });
        }
      }
      for (const [crossingId, devices] of next) deviceStates.set(crossingId, devices);
      tickAll();
    },

    // null clears the fault; a string forces CEK_MANUAL with that cause.
    setLinkFault(cause) {
      if (linkFault === cause) return;
      linkFault = cause;
      tickAll();
    },

    acknowledge(crossingId, operator) {
      const c = crossings.get(crossingId);
      if (!c) return { notFound: true };
      if (c.state !== 'TUTUP' && c.state !== 'MENUNGGU_AMAN') {
        return { conflict: `Konfirmasi hanya bisa saat palang harus tertutup (sekarang ${c.state})` };
      }
      if (!c.ack) {
        const score = decidingNode(c).last?.score_effective ?? null;
        const t = now();
        const tookS = c.closure_started_at != null ? Math.round((t - c.closure_started_at) / 1000) : null;
        c.ack = { by: operator.name || operator.email, email: operator.email, at: new Date(t).toISOString(), score, took_s: tookS };
        call('onAcknowledge', { crossing_id: c.id, crossing_name: c.name, ...c.ack, overdue: c.overdue_notified, operator });
        emit(c, true);
      }
      return { data: view(c) };
    },

    getState(crossingId) {
      const c = crossings.get(crossingId);
      return c ? view(c) : null;
    },

    listStates() {
      return [...crossings.values()].map(view);
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    diagnostics() {
      return { counters: { ...counters }, nodes: [...nodes.values()].map((n) => ({ node_id: n.node_id, state: n.state, cause: n.cause, received_at: n.last ? new Date(n.last.received_at).toISOString() : null })) };
    },

    stop() {
      for (const h of pending.values()) clearTimeout(h);
      pending.clear();
    },
  };
}

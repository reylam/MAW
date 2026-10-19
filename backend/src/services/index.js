import { getDb } from '../config/db.js';
import { data } from '../data/demoData.js';

/*
  Service layer for MAW.

  The single persistent store is MongoDB. When the database is connected
  (getDb() returns a handle) all reads/writes go to MongoDB; otherwise the
  services operate on the in-memory demo dataset so the app still runs for
  demos. API response shapes are identical in both modes.
*/

// Strip Mongo's internal _id so API responses keep their original shape.
const clean = (doc) => {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
};
const cleanAll = (docs) => docs.map(clean);

export const crossingService = {
  async getAll(params = {}) {
    const { page = 1, limit = 20 } = params;
    const start = (page - 1) * limit;
    const db = getDb();

    if (db) {
      const col = db.collection('crossings');
      const total = await col.countDocuments();
      const rows = await col.find().sort({ created_at: -1 }).skip(start).limit(Number(limit)).toArray();
      return { data: cleanAll(rows), meta: { page: Number(page), limit: Number(limit), total } };
    }

    const rows = data.crossings.slice(start, start + Number(limit));
    return { data: rows, meta: { page: Number(page), limit: Number(limit), total: data.crossings.length } };
  },

  async getById(id) {
    const db = getDb();
    if (db) {
      const row = await db.collection('crossings').findOne({ id });
      return { data: clean(row) };
    }
    const row = data.crossings.find((c) => c.id === id);
    return { data: row };
  },

  // Mirror the MAW decision state into the crossing record used by the web dashboard.
  async syncStatus(id, { status, train_detected, barrier_status }) {
    const fields = { last_updated_at: new Date().toISOString() };
    if (status !== undefined) fields.status = status;
    if (train_detected !== undefined) fields.train_detected = train_detected;
    if (barrier_status !== undefined) fields.barrier_status = barrier_status;
    const db = getDb();
    if (db) {
      await db.collection('crossings').updateOne({ id }, { $set: fields });
      return;
    }
    const row = data.crossings.find((c) => c.id === id);
    if (row) Object.assign(row, fields);
  },
};

// Raw node messages (DESIGN.md 8.1) kept for calibration, technicians and the
// web telemetry charts. Demo mode keeps a bounded in-memory buffer.
const memoryReadings = [];
const MEMORY_READINGS_MAX = 5000;

export const readingService = {
  async record(r) {
    const row = {
      node_id: r.node_id,
      crossing_id: r.crossing_id,
      source: r.source,
      timestamp: r.timestamp,
      received_at: new Date(r.received_at).toISOString(),
      data_mentah: r.data_mentah,
      normalisasi: r.normalisasi,
      fusion_score: r.score_node,
      score_calc: r.score_calc,
      score_effective: r.score_effective,
      score_mismatch: r.score_mismatch,
      status: r.status,
    };
    const db = getDb();
    if (db) {
      await db.collection('node_readings').insertOne({ ...row });
      return;
    }
    memoryReadings.push(row);
    if (memoryReadings.length > MEMORY_READINGS_MAX) memoryReadings.splice(0, memoryReadings.length - MEMORY_READINGS_MAX);
  },

  // Oldest first, for charting.
  async list({ crossing_id, since, limit = 2000 }) {
    const db = getDb();
    if (db) {
      const filter = { crossing_id };
      if (since) filter.received_at = { $gte: since };
      const rows = await db.collection('node_readings').find(filter).sort({ received_at: -1 }).limit(Number(limit)).toArray();
      return { data: cleanAll(rows).reverse() };
    }
    const rows = memoryReadings.filter((r) => r.crossing_id === crossing_id && (!since || r.received_at >= since));
    return { data: rows.slice(-Number(limit)) };
  },
};

// Device Health lists every registered device (collection `devices`, always
// shown, MQTT only flips its status) plus any components reported over MQTT
// into the `hardware` collection. Each row carries `kind` so the UI can tell them apart.
const ONLINE = ['connected', 'online'];
const DEGRADED = ['degraded'];

function summarizeHardware(items) {
  const online = items.filter((d) => ONLINE.includes(d.status)).length;
  const degraded = items.filter((d) => DEGRADED.includes(d.status)).length;
  const offline = items.length - online - degraded;
  const withRssi = items.filter((d) => typeof d.rssi === 'number');
  const withBattery = items.filter((d) => typeof d.battery_level === 'number');
  const avg = (list, key) => (list.length ? Math.round((list.reduce((a, d) => a + d[key], 0) / list.length) * 10) / 10 : null);
  return {
    total_devices: items.length,
    online,
    offline,
    degraded,
    critical_failures: offline,
    average_battery: avg(withBattery, 'battery_level'),
    average_rssi: avg(withRssi, 'rssi'),
  };
}

async function allDevices(crossing_id) {
  const filter = crossing_id ? { crossing_id } : {};
  const db = getDb();
  const [devices, hardware] = db
    ? await Promise.all([
        db.collection('devices').find(filter).sort({ crossing_id: 1, id: 1 }).toArray(),
        db.collection('hardware').find(filter).sort({ crossing_id: 1 }).toArray(),
      ])
    : [data.devices, data.hardware].map((rows) => rows.filter((r) => !crossing_id || r.crossing_id === crossing_id));
  const crossings = db ? await db.collection('crossings').find({}, { projection: { id: 1, name: 1 } }).toArray() : data.crossings;
  const names = Object.fromEntries(crossings.map((c) => [c.id, c.name]));
  const named = (row) => ({ ...row, crossing_name: row.crossing_name || names[row.crossing_id] || row.crossing_id });
  return [
    ...cleanAll(devices).map((d) => named({ ...d, kind: 'device' })),
    ...cleanAll(hardware).map((h) => named({ ...h, kind: 'component' })),
  ];
}

export const deviceService = {
  async getAll(params = {}) {
    const rows = await allDevices(params.crossing_id);
    return { data: rows, meta: { total: rows.length } };
  },

  async health() {
    return { data: summarizeHardware(await allDevices()) };
  },
};

export const alertService = {
  async getAll(params = {}) {
    const { page = 1, limit = 20, severity, status, crossing_id } = params;
    const start = (page - 1) * limit;
    const db = getDb();

    if (db) {
      const filter = {};
      if (severity) filter.severity = severity;
      if (status) filter.status = status;
      if (crossing_id) filter.crossing_id = crossing_id;

      const col = db.collection('alerts');
      const total = await col.countDocuments(filter);
      const rows = await col.find(filter).sort({ triggered_at: -1 }).skip(start).limit(Number(limit)).toArray();
      return { data: cleanAll(rows), meta: { page: Number(page), limit: Number(limit), total } };
    }

    let filtered = [...data.alerts];
    if (severity) filtered = filtered.filter((a) => a.severity === severity);
    if (status) filtered = filtered.filter((a) => a.status === status);
    if (crossing_id) filtered = filtered.filter((a) => a.crossing_id === crossing_id);
    return { data: filtered.slice(start, start + Number(limit)), meta: { page: Number(page), limit: Number(limit), total: filtered.length } };
  },

  async acknowledge(id) {
    const now = new Date().toISOString();
    const db = getDb();
    if (db) {
      const row = await db.collection('alerts').findOneAndUpdate(
        { id },
        { $set: { status: 'acknowledged', acknowledged_at: now } },
        { returnDocument: 'after' }
      );
      return { data: clean(row) };
    }
    const row = data.alerts.find((a) => a.id === id);
    if (row) { row.status = 'acknowledged'; row.acknowledged_at = now; }
    return { data: row, success: true };
  },

  // Raise an alert unless one of the same type is still open for the crossing.
  async raise({ crossing_id, alert_type, severity, title, message, device_id = null }) {
    const db = getDb();
    const open = { crossing_id, alert_type, status: { $in: ['active', 'acknowledged'] } };
    if (device_id) open.device_id = device_id; // one open alert per device
    if (db) {
      if (await db.collection('alerts').findOne(open)) return { data: null };
    } else if (data.alerts.some((a) => a.crossing_id === crossing_id && a.alert_type === alert_type && a.status !== 'resolved' && (!device_id || a.device_id === device_id))) {
      return { data: null };
    }
    // Same id / code scheme as existing alerts: alert-001 / ALT-001, next free number.
    const codes = db
      ? (await db.collection('alerts').find({}, { projection: { alert_code: 1 } }).toArray()).map((a) => a.alert_code)
      : data.alerts.map((a) => a.alert_code);
    const next = codes.reduce((max, c) => Math.max(max, Number(/^ALT-(\d+)$/.exec(c || '')?.[1] || 0)), 0) + 1;
    const num = String(next).padStart(3, '0');
    const n = Date.now();
    const row = {
      id: `alert-${num}`,
      alert_code: `ALT-${num}`,
      crossing_id,
      device_id,
      severity,
      alert_type,
      title,
      message,
      status: 'active',
      triggered_at: new Date(n).toISOString(),
    };
    if (db) await db.collection('alerts').insertOne({ ...row });
    else data.alerts.unshift(row);
    return { data: row };
  },

  // Bulk status change for every open alert of the given types on a crossing.
  async closeOpen(crossing_id, alert_types, status, device_id = null) {
    const now = new Date().toISOString();
    const stamp = status === 'resolved' ? { resolved_at: now } : { acknowledged_at: now };
    const from = status === 'resolved' ? ['active', 'acknowledged'] : ['active'];
    const db = getDb();
    if (db) {
      const filter = { crossing_id, alert_type: { $in: alert_types }, status: { $in: from } };
      if (device_id) filter.device_id = device_id;
      await db.collection('alerts').updateMany(filter, { $set: { status, ...stamp } });
      return;
    }
    for (const a of data.alerts) {
      if (a.crossing_id === crossing_id && alert_types.includes(a.alert_type) && from.includes(a.status) && (!device_id || a.device_id === device_id)) {
        Object.assign(a, { status }, stamp);
      }
    }
  },

  async resolve(id) {
    const now = new Date().toISOString();
    const db = getDb();
    if (db) {
      const row = await db.collection('alerts').findOneAndUpdate(
        { id },
        { $set: { status: 'resolved', resolved_at: now } },
        { returnDocument: 'after' }
      );
      return { data: clean(row) };
    }
    const row = data.alerts.find((a) => a.id === id);
    if (row) { row.status = 'resolved'; row.resolved_at = now; }
    return { data: row, success: true };
  },
};

export const telemetryService = {
  async getAll(params = {}) {
    const { crossing_id, device_id, metric, limit = 100 } = params;
    const db = getDb();
    if (db) {
      const filter = {};
      if (crossing_id) filter.crossing_id = crossing_id;
      if (device_id) filter.device_id = device_id;
      if (metric) filter.metric = metric;
      const rows = await db.collection('telemetry').find(filter).sort({ recorded_at: -1 }).limit(Number(limit)).toArray();
      return { data: cleanAll(rows) };
    }
    let rows = data.telemetry;
    if (crossing_id) rows = rows.filter((t) => t.crossing_id === crossing_id);
    if (device_id) rows = rows.filter((t) => t.device_id === device_id);
    if (metric) rows = rows.filter((t) => t.metric === metric);
    return { data: rows.slice(-Number(limit)).reverse() };
  },

  async getLatest() {
    const db = getDb();
    if (db) {
      const rows = await db.collection('telemetry').find().sort({ recorded_at: -1 }).limit(20).toArray();
      return { data: cleanAll(rows) };
    }
    return { data: data.telemetry.slice(-20) };
  },
};

// --- LoRa mesh network -----------------------------------------------------
// Nodes and links live in `network_nodes` / `network_links`; the health summary
// is derived from the node list so it always matches what the topology shows.
function summarizeNetwork(nodes) {
  const radios = nodes.filter((n) => typeof n.rssi === 'number');
  const avg = (items, key) => items.length
    ? Math.round((items.reduce((a, n) => a + n[key], 0) / items.length) * 10) / 10
    : null;
  const online = nodes.filter((n) => n.status === 'online').length;
  return {
    status: nodes.length && online === nodes.length ? 'operational' : online ? 'degraded' : 'offline',
    connected_nodes: online,
    total_nodes: nodes.length,
    average_rssi: avg(radios, 'rssi'),
    average_snr: avg(radios.filter((n) => typeof n.snr === 'number'), 'snr'),
  };
}

export const networkService = {
  async getNodes(params = {}) {
    const { crossing_id } = params;
    const db = getDb();
    if (db) {
      const filter = {};
      if (crossing_id) filter.crossing_id = crossing_id;
      const rows = await db.collection('network_nodes').find(filter).sort({ node_type: -1, id: 1 }).toArray();
      return { data: cleanAll(rows) };
    }
    let rows = [...data.networkNodes];
    if (crossing_id) rows = rows.filter((n) => n.crossing_id === crossing_id);
    return { data: rows };
  },

  async getById(id) {
    const db = getDb();
    const row = db
      ? clean(await db.collection('network_nodes').findOne({ id }))
      : data.networkNodes.find((n) => n.id === id);
    return { data: row };
  },

  async getLinks() {
    const db = getDb();
    if (db) return { data: cleanAll(await db.collection('network_links').find().toArray()) };
    return { data: data.networkLinks };
  },

  async health() {
    const { data: nodes } = await this.getNodes();
    return { data: summarizeNetwork(nodes) };
  },
};

// --- Operator authentication / validation ---------------------------------
// Validates whether an email belongs to an authorized operator. We never return
// the full roster - only a yes/no plus the matched operator's public fields.
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const operatorService = {
  async validate(email) {
    const normalized = normalizeEmail(email);
    if (!EMAIL_RE.test(normalized)) {
      return { authorized: false, reason: 'invalid_format' };
    }

    const db = getDb();
    if (db) {
      const row = await db.collection('operators').findOne({ email: normalized });
      if (!row || row.active === false) return { authorized: false, reason: 'not_authorized' };
      return { authorized: true, operator: { id: row.id, email: row.email, role: row.role, name: row.name } };
    }

    const row = data.operators.find((o) => o.email.toLowerCase() === normalized && o.active !== false);
    if (!row) return { authorized: false, reason: 'not_authorized' };
    return { authorized: true, operator: { id: row.id, email: row.email, role: row.role, name: row.name } };
  },
};

// --- Gate control ----------------------------------------------------------
// Opening a railway crossing gate manually is a safety-critical override. Every
// action is persisted to the `gate_events` collection and the `events` activity
// log with the operator and reason. The current override state is derived from
// the latest gate_event per crossing (or held in memory in demo mode).
const gateOverridesMemory = new Map(); // crossing_id -> override (demo-mode only)

function buildGateView(crossing, override) {
  const automatic = crossing.barrier_status;
  if (override) {
    return {
      crossing_id: crossing.id,
      crossing_name: crossing.name,
      barrier_status: override.barrier_status,
      automatic_status: automatic,
      manual_override: true,
      operator: override.operator,
      reason: override.reason,
      since: override.since,
    };
  }
  return {
    crossing_id: crossing.id,
    crossing_name: crossing.name,
    barrier_status: automatic,
    automatic_status: automatic,
    manual_override: false,
    operator: null,
    reason: null,
    since: null,
  };
}

async function latestOverride(db, crossingId) {
  const last = await db
    .collection('gate_events')
    .find({ crossing_id: crossingId })
    .sort({ timestamp: -1 })
    .limit(1)
    .toArray();
  const ev = last[0];
  if (!ev || ev.type === 'MANUAL_OVERRIDE_RELEASED') return null;
  return {
    barrier_status: ev.barrier_status,
    manual_override: true,
    operator: ev.operator,
    reason: ev.reason,
    since: ev.timestamp,
  };
}

export const gateService = {
  async getStatus(crossingId) {
    const db = getDb();
    if (db) {
      const crossing = await db.collection('crossings').findOne({ id: crossingId });
      if (!crossing) return { data: null };
      const override = await latestOverride(db, crossingId);
      return { data: buildGateView(crossing, override) };
    }
    const crossing = data.crossings.find((c) => c.id === crossingId);
    if (!crossing) return { data: null };
    return { data: buildGateView(crossing, gateOverridesMemory.get(crossingId)) };
  },

  async setGate(crossingId, { action, operator, reason }) {
    const db = getDb();
    const nowIso = new Date().toISOString();
    const target = action === 'close' ? 'closed' : 'open';

    const crossing = db
      ? await db.collection('crossings').findOne({ id: crossingId })
      : data.crossings.find((c) => c.id === crossingId);
    if (!crossing) return { data: null, notFound: true };

    if (action === 'release') {
      const gateEvent = {
        id: `gate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'MANUAL_OVERRIDE_RELEASED',
        crossing_id: crossingId,
        operator,
        operatorId: operator?.id || null,
        operatorName: operator?.name || null,
        reason: null,
        barrier_status: crossing.barrier_status,
        timestamp: nowIso,
      };
      if (db) {
        await db.collection('gate_events').insertOne({ ...gateEvent });
      } else {
        gateOverridesMemory.delete(crossingId);
      }
      await eventService.record({
        event_type: 'manual_override_released',
        severity: 'info',
        crossing_id: crossingId,
        title: 'Manual override released',
        description: `${operator?.name || 'Operator'} returned gate to automatic control`,
        metadata: { operator },
      });
      return { data: buildGateView(crossing, null) };
    }

    const override = { barrier_status: target, manual_override: true, operator, reason: reason || null, since: nowIso };

    const gateEvent = {
      id: `gate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: action === 'open' ? 'MANUAL_GATE_OPEN' : 'MANUAL_GATE_CLOSE',
      crossing_id: crossingId,
      operator,
      operatorId: operator?.id || null,
      operatorName: operator?.name || null,
      reason: reason || null,
      barrier_status: target,
      timestamp: nowIso,
    };

    if (db) {
      await db.collection('gate_events').insertOne({ ...gateEvent });
      await db.collection('crossings').updateOne({ id: crossingId }, { $set: { barrier_status: target, updated_at: nowIso } });
    } else {
      gateOverridesMemory.set(crossingId, override);
    }

    await eventService.record({
      event_type: action === 'open' ? 'manual_gate_open' : 'manual_gate_close',
      severity: action === 'open' ? 'warning' : 'info',
      crossing_id: crossingId,
      title: action === 'open' ? 'Gate opened manually' : 'Gate closed manually',
      description: `${operator?.name || 'Operator'} ${action === 'open' ? 'opened' : 'closed'} the gate manually${reason ? ` - ${reason}` : ''}`,
      metadata: { operator, reason, action },
    });

    return { data: buildGateView(crossing, override) };
  },
};

// --- Events / activity log -------------------------------------------------
const demoEvents = Array.isArray(data.events) ? [...data.events] : [];

export const eventService = {
  async getAll(params = {}) {
    const { crossing_id, limit = 50, since, event_type } = params;
    const types = event_type ? String(event_type).split(',') : null;
    const db = getDb();
    if (db) {
      const filter = {};
      if (crossing_id) filter.crossing_id = crossing_id;
      if (since) filter.occurred_at = { $gte: since };
      if (types) filter.event_type = { $in: types };
      const rows = await db.collection('events').find(filter).sort({ occurred_at: -1 }).limit(Number(limit)).toArray();
      return { data: cleanAll(rows) };
    }
    let rows = [...demoEvents].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
    if (crossing_id) rows = rows.filter((e) => e.crossing_id === crossing_id);
    if (since) rows = rows.filter((e) => e.occurred_at >= since);
    if (types) rows = rows.filter((e) => types.includes(e.event_type));
    return { data: rows.slice(0, Number(limit)) };
  },

  async record(event) {
    const row = {
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      occurred_at: new Date().toISOString(),
      metadata: {},
      ...event,
    };
    const db = getDb();
    if (db) {
      try {
        await db.collection('events').insertOne({ ...row });
      } catch (error) {
        // Non-fatal: logging must never block a safety action.
        console.error('Failed to persist event:', error.message);
      }
      return { data: row };
    }
    demoEvents.unshift(row);
    return { data: row };
  },
};

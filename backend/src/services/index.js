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
};

// Device Health is backed by the `hardware` collection: the physical
// components (MCU, transceiver, sensors) installed at each crossing. The health
// summary and component list are both derived from live data.
function summarizeHardware(items) {
  const online = items.filter((d) => d.status === 'online').length;
  const offline = items.filter((d) => d.status === 'offline').length;
  const degraded = items.filter((d) => d.status === 'degraded').length;
  const withRssi = items.filter((d) => typeof d.rssi === 'number');
  const avgBattery = items.length
    ? items.reduce((a, d) => a + (d.battery_level || 0), 0) / items.length
    : 0;
  const avgRssi = withRssi.length
    ? withRssi.reduce((a, d) => a + d.rssi, 0) / withRssi.length
    : 0;
  return {
    total_devices: items.length,
    online,
    offline,
    degraded,
    critical_failures: offline,
    average_battery: Math.round(avgBattery * 10) / 10,
    average_rssi: Math.round(avgRssi * 10) / 10,
  };
}

export const deviceService = {
  async getAll(params = {}) {
    const { crossing_id } = params;
    const db = getDb();

    if (db) {
      const filter = {};
      if (crossing_id) filter.crossing_id = crossing_id;
      const rows = await db.collection('hardware').find(filter).sort({ crossing_id: 1 }).toArray();
      return { data: cleanAll(rows), meta: { total: rows.length } };
    }

    let rows = [...data.hardware];
    if (crossing_id) rows = rows.filter((h) => h.crossing_id === crossing_id);
    return { data: rows, meta: { total: rows.length } };
  },

  async health() {
    const db = getDb();
    const items = db ? await db.collection('hardware').find().toArray() : data.hardware;
    return { data: summarizeHardware(items) };
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
    return { data: data.telemetry.slice(-Number(limit)) };
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

// --- Operator authentication / validation ---------------------------------
// Validates whether an email belongs to an authorized operator. We never return
// the full roster — only a yes/no plus the matched operator's public fields.
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
      description: `${operator?.name || 'Operator'} ${action === 'open' ? 'opened' : 'closed'} the gate manually${reason ? ` — ${reason}` : ''}`,
      metadata: { operator, reason, action },
    });

    return { data: buildGateView(crossing, override) };
  },
};

// --- Events / activity log -------------------------------------------------
const demoEvents = Array.isArray(data.events) ? [...data.events] : [];

export const eventService = {
  async getAll(params = {}) {
    const { crossing_id, limit = 50 } = params;
    const db = getDb();
    if (db) {
      const filter = {};
      if (crossing_id) filter.crossing_id = crossing_id;
      const rows = await db.collection('events').find(filter).sort({ occurred_at: -1 }).limit(Number(limit)).toArray();
      return { data: cleanAll(rows) };
    }
    let rows = [...demoEvents].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
    if (crossing_id) rows = rows.filter((e) => e.crossing_id === crossing_id);
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

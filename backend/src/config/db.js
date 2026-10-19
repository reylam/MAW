import { MongoClient } from 'mongodb';
import { data } from '../data/demoData.js';

/*
  MongoDB is the single persistent database for MAW.

  Connection is established once at startup via connectDB(). If MONGODB_URI is
  not configured — or the connection fails — the backend transparently falls
  back to in-memory demo data so the dashboard still runs for demos. In both
  cases the service layer talks to the same interface, so API responses are
  identical regardless of the data source.

  Collections: operators, crossings, devices, sensors, telemetry, alerts,
  events, gate_events.
*/

let client = null;
let db = null;
let connected = false;

export function getDb() {
  return db;
}

export function isConnected() {
  return connected;
}

const COLLECTIONS = ['operators', 'crossings', 'devices', 'sensors', 'hardware', 'telemetry', 'alerts', 'events', 'gate_events', 'network_nodes', 'network_links'];

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('MONGODB_URI not set — using in-memory demo data');
    return null;
  }

  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    db = client.db(process.env.MONGODB_DB || 'maw');
    await db.command({ ping: 1 });
    connected = true;
    console.log(`MongoDB connected → database "${db.databaseName}"`);

    await ensureIndexes();
    await seedIfEmpty();
    return db;
  } catch (error) {
    console.error('MongoDB connection failed, falling back to demo data:', error.message);
    connected = false;
    db = null;
    return null;
  }
}

export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    connected = false;
  }
}

async function ensureIndexes() {
  await db.collection('operators').createIndex({ email: 1 }, { unique: true });
  await db.collection('crossings').createIndex({ id: 1 }, { unique: true });
  await db.collection('devices').createIndex({ id: 1 }, { unique: true });
  await db.collection('sensors').createIndex({ id: 1 }, { unique: true });
  await db.collection('hardware').createIndex({ id: 1 }, { unique: true });
  await db.collection('hardware').createIndex({ crossing_id: 1 });
  await db.collection('telemetry').createIndex({ crossing_id: 1, recorded_at: -1 });
  await db.collection('alerts').createIndex({ severity: 1, status: 1 });
  await db.collection('events').createIndex({ occurred_at: -1 });
  await db.collection('gate_events').createIndex({ crossing_id: 1, timestamp: -1 });
  await db.collection('network_nodes').createIndex({ id: 1 }, { unique: true });
  await db.collection('network_links').createIndex({ id: 1 }, { unique: true });
}

// Seed collections from demo data when a collection is empty, so a fresh
// MongoDB instance comes up with a working dataset. Set SEED_RESET=true to
// wipe and re-seed the data collections (useful after changing demoData.js,
// e.g. switching to a single-crossing deployment).
async function seedIfEmpty() {
  const seedMap = {
    operators: data.operators,
    crossings: data.crossings,
    devices: data.devices,
    sensors: data.sensors,
    hardware: data.hardware,
    telemetry: data.telemetry,
    alerts: data.alerts,
    events: data.events,
    network_nodes: data.networkNodes,
    network_links: data.networkLinks,
  };

  const reset = String(process.env.SEED_RESET || '').toLowerCase() === 'true';
  if (reset) {
    console.log('SEED_RESET=true — clearing and re-seeding data collections');
    // Clear runtime collections too so stale state (old crossings' gate events) is removed.
    await db.collection('gate_events').deleteMany({});
  }

  for (const name of Object.keys(seedMap)) {
    const docs = seedMap[name];
    if (!Array.isArray(docs) || docs.length === 0) {
      if (reset) await db.collection(name).deleteMany({});
      continue;
    }
    if (reset) await db.collection(name).deleteMany({});
    const count = await db.collection(name).countDocuments({}, { limit: 1 });
    if (count === 0) {
      await db.collection(name).insertMany(docs.map((d) => ({ ...d })));
      console.log(`Seeded ${docs.length} documents into "${name}"`);
    }
  }
  // gate_events starts empty — populated by operator actions at runtime.
  void COLLECTIONS;
}

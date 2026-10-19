import mqtt from 'mqtt';
import { getDb } from './db.js';
import { data } from '../data/demoData.js';
import { mawNodeTopic } from './maw.js';
import { getEngine } from '../maw/runtime.js';

/*
  MQTT ingest for hardware health.

  Field hardware (ESP32 nodes) publishes to the broker; MAW subscribes and
  mirrors each component's state into the `hardware` collection so it can be
  monitored on the web instead of only in MQTTX.

  Contract
  --------
  Broker:  MQTT_URL (default mqtt://broker.emqx.io:1883)
  Topic:   maw/hardware/<crossing_id>/<component_id>
           - a device may also publish a batch to maw/hardware/<crossing_id>
             with a JSON array of components, or an object with a `components`
             array.
  Payload (JSON), all fields optional except an identifier:
    {
      "name": "MPU6050",
      "component_type": "sensor",      // processor | transceiver | sensor
      "model": "Accelerometer / Gyro",
      "status": "online",              // online | degraded | offline
      "battery": 85,                   // percent
      "rssi": -65,                     // dBm
      "firmware": "1.2.0"
    }

  Liveness: any message refreshes last_seen_at. A component that goes silent
  for longer than MQTT_OFFLINE_TIMEOUT seconds is marked offline automatically.

  Sensor node data (fusion score) arrives on MAW_NODE_TOPIC (default
  maw/node/data, DESIGN.md 8.1) and is handed to the MAW decision engine.
*/

let clientRef = null;
const memory = new Map(); // id -> hardware doc, used when Mongo is not connected

const TOPIC_ROOT = process.env.MQTT_TOPIC_ROOT || 'maw/hardware';
const OFFLINE_TIMEOUT_MS = Number(process.env.MQTT_OFFLINE_TIMEOUT || 30) * 1000;

const slug = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Normalize an incoming payload + topic into a hardware document.
function toHardwareDoc(crossingId, componentKey, payload) {
  const name = payload.name || componentKey || 'Unknown';
  const componentId = slug(payload.component_id || componentKey || name);
  const id = `${crossingId}-${componentId}`;
  const now = new Date().toISOString();

  const doc = {
    id,
    crossing_id: crossingId,
    crossing_name: payload.crossing_name || crossingId,
    name,
    component_type: payload.component_type || 'sensor',
    model: payload.model || '',
    status: payload.status || 'online',
    battery_level: payload.battery ?? payload.battery_level ?? null,
    rssi: payload.rssi ?? null,
    snr: payload.snr ?? null,
    firmware_version: payload.firmware ?? payload.firmware_version ?? null,
    source: 'mqtt',
    last_seen_at: now,
  };
  return doc;
}

async function upsertHardware(doc) {
  const db = getDb();
  if (db) {
    const { id, ...rest } = doc;
    await db.collection('hardware').updateOne(
      { id },
      { $set: { id, ...rest } },
      { upsert: true }
    );
  } else {
    memory.set(doc.id, doc);
    // Keep demo data array in sync so GET /api/devices reflects live MQTT in demo mode.
    const idx = data.hardware.findIndex((h) => h.id === doc.id);
    if (idx >= 0) data.hardware[idx] = { ...data.hardware[idx], ...doc };
    else data.hardware.push(doc);
  }
}

// Parse a message and upsert one or many components.
async function handleMessage(topic, buffer) {
  let payload;
  try {
    payload = JSON.parse(buffer.toString());
  } catch {
    console.warn(`MQTT: ignoring non-JSON payload on ${topic}`);
    return;
  }

  // topic: maw/hardware/<crossing_id>[/<component_id>]
  const parts = topic.split('/');
  const crossingId = parts[2] || 'crossing-01';
  const componentKey = parts[3] || null;

  // Batch forms: array, or { components: [...] }
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.components)
    ? payload.components
    : [{ ...payload, component_id: componentKey }];

  for (const item of list) {
    const key = item.component_id || componentKey || item.name;
    if (!key) continue;
    await upsertHardware(toHardwareDoc(crossingId, key, item));
  }
}

// Mark components that have gone silent as offline.
async function sweepOffline() {
  const cutoff = Date.now() - OFFLINE_TIMEOUT_MS;
  const db = getDb();
  if (db) {
    await db.collection('hardware').updateMany(
      { source: 'mqtt', status: { $ne: 'offline' }, last_seen_at: { $lt: new Date(cutoff).toISOString() } },
      { $set: { status: 'offline', battery_level: 0 } }
    );
  } else {
    for (const doc of data.hardware) {
      if (doc.source === 'mqtt' && doc.status !== 'offline' && new Date(doc.last_seen_at).getTime() < cutoff) {
        doc.status = 'offline';
      }
    }
  }
}

export function initMqtt() {
  const url = process.env.MQTT_URL;
  if (!url) {
    console.log('MQTT_URL not set - hardware MQTT ingest disabled');
    return null;
  }

  const options = {
    clientId: process.env.MQTT_CLIENT_ID || `maw-backend-${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  };
  if (process.env.MQTT_USERNAME) options.username = process.env.MQTT_USERNAME;
  if (process.env.MQTT_PASSWORD) options.password = process.env.MQTT_PASSWORD;

  const nodeTopic = mawNodeTopic();
  const topics = [`${TOPIC_ROOT}/#`, nodeTopic];
  const client = mqtt.connect(url, options);
  clientRef = client;

  const engine = getEngine();
  engine.setLinkFault('Koneksi broker terputus');
  client.on('close', () => engine.setLinkFault('Koneksi broker terputus'));
  client.on('connect', () => {
    engine.setLinkFault(null);
    console.log(`MQTT connected → ${url}`);
    client.subscribe(topics, (err) => {
      if (err) console.error('MQTT subscribe failed:', err.message);
      else console.log(`MQTT subscribed → ${topics.join(', ')}`);
    });
  });

  client.on('message', (t, m) => {
    if (t === nodeTopic) {
      getEngine().ingest(m, { source: 'mqtt' });
      return;
    }
    handleMessage(t, m).catch((e) => console.error('MQTT handle error:', e.message));
  });
  client.on('error', (e) => console.error('MQTT error:', e.message));
  client.on('reconnect', () => console.log('MQTT reconnecting…'));

  const sweeper = setInterval(() => { sweepOffline().catch(() => {}); }, Math.min(OFFLINE_TIMEOUT_MS, 15000));
  client.sweeper = sweeper;

  return client;
}

export function isMqttConnected() {
  return Boolean(clientRef && clientRef.connected);
}

export function closeMqtt() {
  if (clientRef) {
    clearInterval(clientRef.sweeper);
    clientRef.end(true);
    clientRef = null;
  }
}

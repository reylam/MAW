import mqtt from 'mqtt';
import { getDb } from './db.js';
import { data } from '../data/demoData.js';
import { mawNodeTopic } from './maw.js';
import { getEngine, refreshDevices } from '../maw/runtime.js';

/*
  MQTT ingest for device health.

  Registered devices (collection `devices`) are always shown on the web; a
  message that names one of them only changes its status (connected /
  disconnected) and last_seen_at. Messages for unknown ids are kept as
  components in the `hardware` collection, as before.

  Contract
  --------
  Broker:  HARDWARE_MQTT_URL (or MQTT_URL)
  Topic:   maw/hardware/<crossing_id>/<device_id or component_id>
  Device status, e.g. on maw/hardware/crossing-01/device-1:
    { "status": "connected" }            // or "disconnected" / "online" / "offline"
    { "device_id": "device-1", "connected": false }
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
  mqx/node/data, DESIGN.md 8.1) and is handed to the MAW decision engine.
*/

let clientRef = null; // node data connection
let hardwareRef = null; // website hardware connection (optional)
let sweeper = null;
const memory = new Map(); // id -> hardware doc, used when Mongo is not connected

const TOPIC_ROOT = process.env.MQTT_TOPIC_ROOT || 'maw/hardware';
const OFFLINE_TIMEOUT_MS = Number(process.env.MQTT_OFFLINE_TIMEOUT ?? 30) * 1000;

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

// MQTT status values -> the values stored in the devices collection.
function normalizeStatus(item) {
  if (typeof item.connected === 'boolean') return item.connected ? 'connected' : 'disconnected';
  const s = String(item.status ?? '').trim().toLowerCase();
  if (['connected', 'online', 'on', 'up', 'true', '1'].includes(s)) return 'connected';
  if (['disconnected', 'offline', 'off', 'down', 'false', '0'].includes(s)) return 'disconnected';
  return s || null;
}

/*
  Registered devices live in the `devices` collection and are always listed.
  A message that names one of them (device_id / id / device_code / name, or the
  last topic segment) only updates its status and last_seen_at.
*/
async function updateDeviceStatus(keys, status) {
  const wanted = keys.filter(Boolean).map((k) => String(k).toLowerCase());
  if (!wanted.length || !status) return false;
  const fields = { status, last_seen_at: new Date().toISOString() };
  const db = getDb();
  if (db) {
    const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exact = (k) => new RegExp(`^${esc(k)}$`, 'i');
    const prefix = (k) => new RegExp(`^${esc(k)}-`, 'i'); // esp32 -> ESP32-CROSSING-01
    const ors = wanted.flatMap((k) => [{ id: k }, { device_code: exact(k) }, { device_code: prefix(k) }, { name: exact(k) }]);
    const res = await db.collection('devices').updateOne({ $or: ors }, { $set: fields });
    return res.matchedCount > 0;
  }
  const row = data.devices.find((d) => [d.id, d.device_code, d.name].some((v) => v && wanted.includes(String(v).toLowerCase()))
    || (d.device_code && wanted.some((k) => String(d.device_code).toLowerCase().startsWith(`${k}-`))));
  if (row) Object.assign(row, fields);
  return Boolean(row);
}

// Parse a message: update a registered device's status, else upsert hardware components.
async function handleMessage(topic, buffer) {
  let payload;
  try {
    payload = JSON.parse(buffer.toString());
  } catch {
    console.warn(`MQTT: ignoring non-JSON payload on ${topic}`);
    return;
  }

  // topic: <MQTT_TOPIC_ROOT>/<crossing_id>[/<device_or_component>]
  const parts = topic.slice(TOPIC_ROOT.length).split('/').filter(Boolean);
  const crossingId = parts[0] || 'crossing-01';
  const componentKey = parts[1] || null;

  // Batch forms: array, or { components: [...] } / { devices: [...] }
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.components)
    ? payload.components
    : Array.isArray(payload?.devices)
    ? payload.devices
    : [{ ...payload, component_id: payload.component_id ?? componentKey }];

  let changed = false;
  for (const item of list) {
    const updated = await updateDeviceStatus(
      [item.device_id, item.id, item.device_code, item.name, item.component_id, componentKey],
      normalizeStatus(item),
    );
    if (updated) { changed = true; continue; }
    const key = item.component_id || componentKey || item.name;
    if (!key) continue;
    await upsertHardware(toHardwareDoc(crossingId, key, item));
  }
  // The barrier logic depends on device status: apply it right away.
  if (changed) await refreshDevices();
}

// Mark components that have gone silent as offline (only the status; the last
// values MQTTX sent are kept). Disabled when MQTT_OFFLINE_TIMEOUT=0.
async function sweepOffline() {
  const cutoff = Date.now() - OFFLINE_TIMEOUT_MS;
  const db = getDb();
  if (db) {
    await db.collection('hardware').updateMany(
      { source: 'mqtt', status: { $ne: 'offline' }, last_seen_at: { $lt: new Date(cutoff).toISOString() } },
      { $set: { status: 'offline' } }
    );
  } else {
    for (const doc of data.hardware) {
      if (doc.source === 'mqtt' && doc.status !== 'offline' && new Date(doc.last_seen_at).getTime() < cutoff) {
        doc.status = 'offline';
      }
    }
  }
}

/*
  Two broker connections:
    node      MQTT_URL / MQTT_CLIENT_ID            -> MAW_NODE_TOPIC (barrier decisions, mobile + web)
    hardware  HARDWARE_MQTT_URL / HARDWARE_MQTT_CLIENT_ID -> MQTT_TOPIC_ROOT/# (website device health)
  Without HARDWARE_MQTT_URL both topics share the node connection.
  Client ids always get a random suffix: on a shared broker two connections
  with the same id (e.g. the MQTTX "Hardware-MAW" session) kick each other off.
*/
function connect(label, url, clientId, topics, onMessage, { onUp, onDown } = {}) {
  const options = {
    clientId: `${clientId}-${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
    keepalive: 30,
    clean: true,
  };
  if (process.env.MQTT_USERNAME) options.username = process.env.MQTT_USERNAME;
  if (process.env.MQTT_PASSWORD) options.password = process.env.MQTT_PASSWORD;

  const client = mqtt.connect(url, options);
  client.on('connect', () => {
    onUp?.();
    console.log(`MQTT ${label} connected → ${url} (${options.clientId})`);
    client.subscribe(topics, (err) => {
      if (err) console.error(`MQTT ${label} subscribe failed:`, err.message);
      else console.log(`MQTT ${label} subscribed → ${topics.join(', ')}`);
    });
  });
  client.on('close', () => onDown?.());
  client.on('message', onMessage);
  client.on('error', (e) => console.error(`MQTT ${label} error:`, e.message));
  client.on('reconnect', () => console.log(`MQTT ${label} reconnecting…`));
  return client;
}

const handleHardware = (t, m) => { handleMessage(t, m).catch((e) => console.error('MQTT handle error:', e.message)); };

export function initMqtt() {
  const url = process.env.MQTT_URL;
  if (!url) {
    console.log('MQTT_URL not set - MQTT ingest disabled');
    return null;
  }

  const engine = getEngine();
  const nodeTopic = mawNodeTopic();
  const hardwareTopic = `${TOPIC_ROOT}/#`;
  const hardwareUrl = process.env.HARDWARE_MQTT_URL;
  const shared = !hardwareUrl;

  engine.setLinkFault('Koneksi broker terputus');
  clientRef = connect(
    'node',
    url,
    process.env.MQTT_CLIENT_ID || 'maw-backend',
    shared ? [nodeTopic, hardwareTopic] : [nodeTopic],
    (t, m) => (t === nodeTopic ? engine.ingest(m, { source: 'mqtt' }) : handleHardware(t, m)),
    { onUp: () => engine.setLinkFault(null), onDown: () => engine.setLinkFault('Koneksi broker terputus') },
  );

  if (!shared) {
    hardwareRef = connect('hardware', hardwareUrl, process.env.HARDWARE_MQTT_CLIENT_ID || 'maw-web-hardware', [hardwareTopic], handleHardware);
  }

  if (OFFLINE_TIMEOUT_MS > 0) {
    sweeper = setInterval(() => { sweepOffline().catch(() => {}); }, Math.min(OFFLINE_TIMEOUT_MS, 15000));
  }
  return clientRef;
}

export function isMqttConnected() {
  return Boolean(clientRef && clientRef.connected);
}

export function isHardwareMqttConnected() {
  return Boolean((hardwareRef || clientRef)?.connected);
}

export function closeMqtt() {
  clearInterval(sweeper);
  sweeper = null;
  clientRef?.end(true);
  hardwareRef?.end(true);
  clientRef = null;
  hardwareRef = null;
}

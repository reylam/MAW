import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as services from './services/index.js';
import { isConnected } from './config/db.js';
import { isMqttConnected, isHardwareMqttConnected } from './config/mqtt.js';
import { getEngine } from './maw/runtime.js';
import * as simRunner from './maw/simRunner.js';

const notFound = (res) => res.status(404).json({ success: false, error: { message: 'Route not found', code: 'ROUTE_NOT_FOUND' } });
const isProd = () => process.env.NODE_ENV === 'production';

/*
  Simulation feeds fake sensor data into the barrier decision engine, so on a
  public server it is off unless MAW_ENABLE_SIM=true, and then only a
  supervisor may start or stop it (the scenario list stays readable).
*/
const simGuard = (requireSupervisor) => async (req, res, next) => {
  if (!isProd()) return next();
  if (process.env.MAW_ENABLE_SIM !== 'true') return notFound(res);
  if (!requireSupervisor) return next();
  try {
    const authz = await services.operatorService.validate(req.body?.operator?.email);
    if (!authz.authorized || authz.operator.role !== 'supervisor') {
      return res.status(403).json({ success: false, error: { message: 'Simulation requires a supervisor.' } });
    }
    next();
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
};

// FRONTEND_URL: one origin or a comma separated list. A * matches one subdomain
// label, e.g. https://*.vercel.app for Vercel preview deployments.
const originPatterns = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean)
  .map((o) => {
    const escaped = o.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped.replace(/\*/g, '[^./]+')}$`, 'i');
  });

const app = express();
app.set('trust proxy', 1); // behind the hosting provider's reverse proxy
app.use(helmet());
app.use(cors({
  // Requests without an Origin (the mobile app, curl, health checks) are not browser CORS requests.
  origin: (origin, callback) => callback(null, !origin || originPatterns.some((re) => re.test(origin))),
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

app.get('/api/health', (_req, res) => res.json({ 
  success: true, 
  service: 'MAW API', 
  status: 'operational', 
  db: isConnected() ? 'mongodb' : 'demo',
  mqtt: isMqttConnected() ? 'connected' : 'disconnected',
  mqtt_hardware: isHardwareMqttConnected() ? 'connected' : 'disconnected',
}));

// Crossings
app.get('/api/crossings', async (req, res) => {
  try {
    const { data, meta } = await services.crossingService.getAll(req.query);
    res.json({ success: true, data, meta });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

app.get('/api/crossings/:id', async (req, res) => {
  try {
    const { data } = await services.crossingService.getById(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: { message: 'Crossing not found' } });
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

// Alerts
app.get('/api/alerts', async (req, res) => {
  try {
    const { data, meta } = await services.alertService.getAll(req.query);
    res.json({ success: true, data, meta });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

app.patch('/api/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { data } = await services.alertService.acknowledge(req.params.id);
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

app.patch('/api/alerts/:id/resolve', async (req, res) => {
  try {
    const { data } = await services.alertService.resolve(req.params.id);
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

// Telemetry
app.get('/api/telemetry', async (req, res) => {
  try {
    const { data } = await services.telemetryService.getAll(req.query);
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

app.get('/api/telemetry/latest', async (req, res) => {
  try {
    const { data } = await services.telemetryService.getLatest();
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

// Auth - operator validation (email authorization). Returns only a yes/no plus
// public operator fields; the full roster is never exposed to the client.
app.post('/api/auth/validate-operator', async (req, res) => {
  try {
    const { email } = req.body || {};
    const result = await services.operatorService.validate(email);
    if (!result.authorized) {
      const message = result.reason === 'invalid_format'
        ? 'Please enter a valid email address.'
        : 'This email is not authorized to access MAW. Contact your supervisor.';
      return res.status(result.reason === 'invalid_format' ? 400 : 403).json({ success: false, error: { message, code: result.reason } });
    }
    res.json({ success: true, data: result.operator });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

// Gate control
app.get('/api/crossings/:id/gate', async (req, res) => {
  try {
    const { data } = await services.gateService.getStatus(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: { message: 'Crossing not found' } });
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

app.post('/api/crossings/:id/gate', async (req, res) => {
  try {
    const { action, operator, reason } = req.body || {};
    if (!['open', 'close', 'release'].includes(action)) {
      return res.status(400).json({ success: false, error: { message: "action must be 'open', 'close' or 'release'" } });
    }
    if (!operator?.email) {
      return res.status(401).json({ success: false, error: { message: 'Operator session required for gate control.' } });
    }
    const authz = await services.operatorService.validate(operator.email);
    if (!authz.authorized) {
      return res.status(403).json({ success: false, error: { message: 'Operator is not authorized to control the gate.' } });
    }
    const result = await services.gateService.setGate(req.params.id, { action, operator, reason });
    if (result.notFound) return res.status(404).json({ success: false, error: { message: 'Crossing not found' } });
    res.json({ success: true, data: result.data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

// Events / activity log
app.get('/api/events', async (req, res) => {
  try {
    const { data } = await services.eventService.getAll(req.query);
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

// Devices / hardware
app.get('/api/devices', async (req, res) => {
  try {
    const { data, meta } = await services.deviceService.getAll(req.query);
    res.json({ success: true, data, meta });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

app.get('/api/devices/health', async (req, res) => {
  try {
    const { data } = await services.deviceService.health();
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

// LoRa mesh network
app.get('/api/network/nodes', async (req, res) => {
  try {
    const { data } = await services.networkService.getNodes(req.query);
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

app.get('/api/network/nodes/:id', async (req, res) => {
  try {
    const { data } = await services.networkService.getById(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: { message: 'Node not found' } });
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

app.get('/api/network/links', async (req, res) => {
  try {
    const { data } = await services.networkService.getLinks();
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

app.get('/api/network/health', async (req, res) => {
  try {
    const { data } = await services.networkService.health();
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

// MAW petugas: palang instruction state (DESIGN.md 8.6). Live updates use WebSocket /ws.
app.get('/api/maw/config', (_req, res) => {
  const { weights, T_TUTUP, T_SIAGA, HOLD_BUKA_S, STALE_MAX_S, HEARTBEAT_S, SCORE_TOL } = getEngine().config;
  res.json({ success: true, data: { weights, T_TUTUP, T_SIAGA, HOLD_BUKA_S, STALE_MAX_S, HEARTBEAT_S, SCORE_TOL } });
});

app.get('/api/maw/crossings', (_req, res) => {
  res.json({ success: true, data: getEngine().listStates() });
});

app.get('/api/maw/diagnostics', (_req, res) => {
  res.json({ success: true, data: getEngine().diagnostics() });
});

app.get('/api/crossings/:id/state', (req, res) => {
  const data = getEngine().getState(req.params.id);
  if (!data) return res.status(404).json({ success: false, error: { message: 'Crossing is not monitored by any node' } });
  res.json({ success: true, data });
});

app.post('/api/crossings/:id/ack', async (req, res) => {
  try {
    const { operator } = req.body || {};
    if (!operator?.email) {
      return res.status(401).json({ success: false, error: { message: 'Operator session required.' } });
    }
    const authz = await services.operatorService.validate(operator.email);
    if (!authz.authorized) {
      return res.status(403).json({ success: false, error: { message: 'Operator is not authorized.' } });
    }
    // Email is authorized server-side; the web lets the operator pick a display name.
    const who = { ...authz.operator, name: String(operator.name || '').trim() || authz.operator.name };
    const result = getEngine().acknowledge(req.params.id, who);
    if (result.notFound) return res.status(404).json({ success: false, error: { message: 'Crossing is not monitored by any node' } });
    if (result.conflict) return res.status(409).json({ success: false, error: { message: result.conflict } });
    res.json({ success: true, data: result.data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

app.get('/api/crossings/:id/events', async (req, res) => {
  try {
    const { date, limit = 10 } = req.query;
    let since;
    if (date === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      since = start.toISOString();
    }
    const { data } = await services.eventService.getAll({
      crossing_id: req.params.id,
      event_type: 'maw_state,maw_ack,maw_ack_overdue,maw_score_mismatch,device_status',
      since,
      limit,
    });
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

// Real node data (node_readings) for the web telemetry charts, oldest first.
app.get('/api/crossings/:id/readings', async (req, res) => {
  try {
    const minutes = Math.min(Number(req.query.minutes) || 60, 7 * 24 * 60);
    const since = new Date(Date.now() - minutes * 60_000).toISOString();
    const { data } = await services.readingService.list({ crossing_id: req.params.id, since, limit: req.query.limit || 2000 });
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, error: { message: error.message } }); }
});

// Feed one node payload without hardware (development/demo only).
app.post('/api/maw/simulate', simGuard(true), (req, res) => {
  const result = getEngine().ingest(req.body || {}, { source: 'simulate' });
  res.status(result.accepted ? 200 : 422).json({ success: result.accepted, data: result });
});

// Simulation Center: run a scenario (scripts/scenarios.json) every heartbeat until stopped.
app.get('/api/maw/sim', simGuard(false), (_req, res) => {
  res.json({ success: true, data: { ...simRunner.status(), scenarios: simRunner.listScenarios() } });
});

app.post('/api/maw/sim/start', simGuard(true), (req, res) => {
  const result = simRunner.start(req.body?.scenario);
  if (result.error) return res.status(404).json({ success: false, error: { message: result.error } });
  res.json({ success: true, data: result.data });
});

app.post('/api/maw/sim/stop', simGuard(true), (_req, res) => {
  res.json({ success: true, data: simRunner.stop().data });
});

app.use((_req, res) => notFound(res));
app.use((error, _req, res, _next) => res.status(500).json({ success: false, error: { message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message, code: 'INTERNAL_ERROR' } }));
export default app;

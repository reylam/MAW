import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as services from './services/index.js';
import { isConnected } from './config/db.js';
import { isMqttConnected } from './config/mqtt.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

app.get('/api/health', (_req, res) => res.json({ 
  success: true, 
  service: 'MAW API', 
  status: 'operational', 
  db: isConnected() ? 'mongodb' : 'demo',
  mqtt: isMqttConnected() ? 'connected' : 'disconnected'
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

// Auth — operator validation (email authorization). Returns only a yes/no plus
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

app.use((_req, res) => res.status(404).json({ success: false, error: { message: 'Route not found', code: 'ROUTE_NOT_FOUND' } }));
app.use((error, _req, res, _next) => res.status(500).json({ success: false, error: { message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message, code: 'INTERNAL_ERROR' } }));
export default app;

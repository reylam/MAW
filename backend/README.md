# MAW Backend

Express.js + MongoDB API for MAW Smart Rail Guard.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
```

3. Fill in `.env` with your MongoDB connection:
   - `MONGODB_URI`: connection string
     - Local: `mongodb://localhost:27017`
     - Atlas: `mongodb+srv://<user>:<password>@<cluster>/?retryWrites=true&w=majority`
   - `MONGODB_DB`: database name (default `maw`)

   Leave `MONGODB_URI` empty to run on in-memory demo data (see Demo Mode).

4. (Optional) Provision the database manually:
```bash
mongosh "<MONGODB_URI>/maw" database/init.mongo.js
```
   The backend also creates indexes and seeds demo data automatically on first
   connect, so this step is optional.

5. Start backend:
```bash
npm run dev
```

Backend runs on `http://localhost:5000`

## Database

MongoDB is the single persistent database. Collections:

- `operators` — authorized operators (login validation)
- `crossings` — level crossing status (including `barrier_status`)
- `devices` — field sensor nodes / gateways
- `sensors` — individual sensors per device
- `hardware` — hardware components per crossing (powers Device Health)
- `telemetry` — time-series sensor readings
- `alerts` — raised alerts
- `events` — activity / audit log
- `gate_events` — manual gate-control actions (override audit trail)

## API

- `GET /api/health` — health check (reports `db: mongodb | demo`, `mqtt: connected | disconnected`)
- `GET /api/crossings` — list crossings
- `GET /api/crossings/:id` — crossing detail
- `GET /api/alerts` — list alerts
- `PATCH /api/alerts/:id/acknowledge` — acknowledge alert
- `PATCH /api/alerts/:id/resolve` — resolve alert
- `GET /api/telemetry` / `GET /api/telemetry/latest` — telemetry
- `GET /api/devices` — hardware components (supports `?crossing_id=`), from the `hardware` collection
- `GET /api/devices/health` — hardware health summary (online/degraded/offline, avg battery/RSSI)
- `GET /api/events` — activity log (supports `?crossing_id=` and `?limit=`)

### Operator authentication

- `POST /api/auth/validate-operator` — body `{ "email": "..." }`.
  Validates the email against the authorized operator roster in MongoDB.
  Returns the operator's public fields on success; `403` when not authorized,
  `400` for a malformed email. The full roster is never returned to the client.

### Gate control (manual override)

- `GET /api/crossings/:id/gate` — current gate state, including whether a
  manual override is active, the operator, and the reason.
- `POST /api/crossings/:id/gate` — body
  `{ "action": "open|close|release", "operator": { "email", "name" }, "reason": "..." }`.
  The operator email is re-validated server-side. `open`/`close` set a manual
  override; `release` returns control to the automatic system. Every action is
  persisted to the `gate_events` collection and the `events` activity log.

> Authorized operators live in the `operators` collection (seeded from
> `database/init.mongo.js` / `src/data/demoData.js`). Add real operators there
> rather than hardcoding emails in the frontend.

## Hardware over MQTT

Field hardware (ESP32 nodes) reports component health over MQTT. The backend
subscribes and mirrors each component into the `hardware` collection, so it is
visible on the web (Device Health page) without opening MQTTX.

Configure in `.env`:

- `MQTT_URL` — broker, e.g. `mqtt://broker.emqx.io:1883` (empty = ingest disabled)
- `MQTT_TOPIC_ROOT` — default `maw/hardware`
- `MQTT_CLIENT_ID` — default `maw-backend`
- `MQTT_OFFLINE_TIMEOUT` — seconds of silence before a component is marked offline (default 30)
- `MQTT_USERNAME` / `MQTT_PASSWORD` — optional, for authenticated brokers

**Publish contract**

Topic: `maw/hardware/<crossing_id>/<component_id>`
(e.g. `maw/hardware/crossing-01/mpu6050`)

Payload (JSON, all fields optional except an identifier):

```json
{
  "name": "MPU6050",
  "component_type": "sensor",
  "model": "Accelerometer / Gyro",
  "status": "online",
  "battery": 85,
  "rssi": -65,
  "firmware": "1.2.0"
}
```

A device may also publish a batch to `maw/hardware/<crossing_id>` as a JSON
array, or an object with a `components` array. Each message refreshes the
component's `last_seen_at`; a component that stops reporting past the offline
timeout is marked `offline` automatically.

## Demo Mode

Without `MONGODB_URI`, the API serves in-memory demo data from
`src/data/demoData.js`. The same data seeds a fresh MongoDB database on first
connect.

Configure frontend `VITE_API_URL=http://localhost:5000/api` to use this backend.

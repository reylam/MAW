# MAW Backend

Express.js + MongoDB API for MAW Smart Rail Guard. It receives sensor node data over MQTT, runs the barrier decision engine, keeps devices, alerts and events in MongoDB, and pushes live state to the web dashboard and the mobile app over WebSocket.

## Setup

```bash
npm install
cp .env.example .env
npm run dev            # http://localhost:5000
```

Fill `.env` (see [Environment](#environment)). Leave `MONGODB_URI` empty to run on in-memory demo data. `GET /api/health` tells you what you are running on:

```json
{ "status": "operational", "db": "mongodb", "mqtt": "connected", "mqtt_hardware": "connected" }
```

`db: demo` means MongoDB is not connected: either `MONGODB_URI` is empty or the connection failed (the log says why). With Atlas, a `SSL alert number 80` error means your public IP is not allowed: add it under Network Access.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-restart (`node --watch`) |
| `npm start` | Start |
| `npm test` | Run the tests |
| `npm run s4` / `s5` / `s3` | Publish a SAFE / WARNING / DANGER node payload every 5 s |
| `npm run train` | Publish a train passing, start to finish |
| `npm run sim -- <scenario> [once]` | Any scenario from `scripts/scenarios.json`; `once` sends a single message |
| `npm run connected_<DEVICE>` | Mark a device connected over MQTT |
| `npm run disconnected_<DEVICE>` | Mark a device disconnected over MQTT |

`<DEVICE>` is one of `ESP32`, `MPU6500`, `HX711`, `HMC5883L`, `MAX9814`, for example `npm run disconnected_MPU6500`.

To add a scenario, paste a payload from the firmware into `scripts/scenarios.json` under a new key (for example `s6`) and run `npm run sim -- s6`. The web Simulation Center lists it automatically.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | HTTP port |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |
| `MONGODB_URI` | empty | Connection string. Empty means demo data. |
| `MONGODB_DB` | `maw` | Database name |
| `MQTT_URL` | empty | Broker for node data, e.g. `wss://broker.emqx.io:8084/mqtt`. Empty disables MQTT. |
| `MQTT_CLIENT_ID` | `maw-backend` | Client id prefix (a random suffix is always added) |
| `MQTT_USERNAME`, `MQTT_PASSWORD` | empty | For authenticated brokers |
| `MAW_NODE_TOPIC` | `mqx/node/data` | Topic the sensor node publishes to |
| `HARDWARE_MQTT_URL` | empty | Separate broker connection for device status. Empty reuses `MQTT_URL`. |
| `HARDWARE_MQTT_CLIENT_ID` | `maw-web-hardware` | Client id prefix for that connection |
| `MQTT_TOPIC_ROOT` | `maw/hardware` | Device status topics: `<root>/<crossing_id>/<device>` |
| `MQTT_OFFLINE_TIMEOUT` | `30` | Seconds of silence before a hardware component is marked offline. `0` disables it. |
| `MAW_T_TUTUP` | `0.60` | Close threshold. Must equal the ESP32 firmware threshold. |
| `MAW_T_SIAGA` | `0.40` | Get-ready threshold, and the level the score must drop below before opening |
| `MAW_HOLD_BUKA_S` | `20` | Seconds the score must stay low before the barrier may open |
| `MAW_STALE_MAX_S` | `15` | Seconds without node data before manual check |
| `MAW_HEARTBEAT_S` | `5` | Expected node publish interval |
| `MAW_SCORE_TOL` | `0.02` | Allowed difference between the node score and the recomputed score |
| `MAW_CLOSE_DEADLINE_S` | `20` | Seconds the guard has to confirm the barrier is closed |
| `MAW_W_GETARAN`, `MAW_W_BEBAN`, `MAW_W_MAGNET`, `MAW_W_SUARA` | `0.35`, `0.30`, `0.20`, `0.15` | Sensor weights (sum to 1.00) |
| `MAW_NODE_MAP` | empty | JSON node-to-crossing map. Empty uses `src/config/nodeMap.json`. |

## Sensor node data (MQTT)

The node publishes JSON to `MAW_NODE_TOPIC` every heartbeat, including when no train is present:

```json
{
  "node_id": "SN_001",
  "timestamp": 1792419342,
  "data_mentah": { "getaran_mpu6500": 665, "beban_hx711": 384, "magnet_hmc5883l": 195, "suara_max9814": 218 },
  "normalisasi": { "v_norm": 0.05, "l_norm": 0.02, "m_norm": 0.04, "s_norm": 0.10 },
  "fusion_score": 0.05,
  "status": "SAFE"
}
```

`status` is `SAFE`, `WARNING` or `DANGER`. Publish with QoS 1 so messages are not lost.

For every message the backend validates the payload, drops unknown nodes and duplicates, recomputes the score from the weights, and runs the state machine. Rules and edge cases: [../mobile/DESIGN.md](../mobile/DESIGN.md) sections 3 and 8.

`src/config/nodeMap.json` maps each registered `node_id` to a crossing and its device:

```json
{ "SN_001": { "crossing_id": "crossing-01", "crossing_name": "Crossing #01", "device_id": "device-1" } }
```

Only registered nodes are accepted. A registered node that never reports keeps its crossing in manual check.

## Device status (MQTT)

Registered devices live in the `devices` collection and are always listed. MQTT only changes their `status` (`connected` or `disconnected`) and `last_seen_at`. Registered devices: the ESP32 node and its sensors MPU6500, HX711 + Load Cell, HMC5883L and MAX9814.

Topic `<MQTT_TOPIC_ROOT>/<crossing_id>/<device>`, for example `maw/hardware/crossing-01/mpu6500`:

```json
{ "status": "disconnected" }
```

A device is matched by `device_id`, `id`, `device_code` or `name` in the payload, or by the last topic segment. `online` / `offline` are accepted and stored as `connected` / `disconnected`. A message for an unknown id is kept as a free component in the `hardware` collection.

When any registered device is disconnected, its crossing goes to **manual check** (fail-safe), a `device_disconnected` alert is raised, and the website shows a pop-up. Reconnecting resolves the alert and the state is recomputed. Statuses are re-read from MongoDB every 15 s, so edits made directly in the database also take effect.

## Alerts

Alerts keep the existing format (`alert-001` / `ALT-001`, `severity`, `alert_type`, `status`, `triggered_at`) and are managed automatically:

| `alert_type` | Raised when | Closed when |
|---|---|---|
| `train_detected` | The crossing enters TUTUP | Acknowledged by the guard, resolved when the crossing is AMAN or SIAGA again |
| `ack_overdue` | No confirmation within `MAW_CLOSE_DEADLINE_S` | The guard confirms, or the crossing is safe |
| `manual_check` | Stale data or broker down | Data is back |
| `device_disconnected` | A registered device disconnects (one alert per device) | The device reconnects |
| `score_mismatch` | Node score differs from the recomputed score | The scores agree again |

## API

Base path `/api`. Responses are `{ "success": true, "data": ... }`.

**General**
- `GET /health`
- `GET /crossings`, `GET /crossings/:id`
- `GET /alerts` (filters: `severity`, `status`, `crossing_id`), `PATCH /alerts/:id/acknowledge`, `PATCH /alerts/:id/resolve`
- `GET /events` (filters: `crossing_id`, `limit`, `since`, `event_type`)
- `GET /devices` (filter: `crossing_id`), `GET /devices/health`
- `GET /network/nodes`, `GET /network/nodes/:id`, `GET /network/links`, `GET /network/health`
- `GET /telemetry`, `GET /telemetry/latest`

**Barrier decision (MAW)**
- `GET /crossings/:id/state`: current instruction, score, thresholds, devices, deadline
- `GET /maw/crossings`: state of every monitored crossing
- `GET /maw/config`: thresholds, weights and timings in force
- `GET /maw/diagnostics`: message counters and node states
- `POST /crossings/:id/ack`: the guard confirms the barrier is closed. Body `{ "operator": { "email", "name" } }`; the email is validated against the operator roster.
- `GET /crossings/:id/events?date=today`: today's decision history
- `GET /crossings/:id/readings?minutes=60`: stored node readings for charts

**Simulation** (disabled when `NODE_ENV=production`)
- `POST /maw/simulate`: feed one node payload
- `GET /maw/sim`, `POST /maw/sim/start` (`{ "scenario": "s3" }`), `POST /maw/sim/stop`

**Operators and manual gate control**
- `POST /auth/validate-operator`: body `{ "email": "..." }`. `403` when not authorized, `400` for a malformed email. The roster is never returned.
- `GET /crossings/:id/gate`, `POST /crossings/:id/gate`: manual override (`open`, `close`, `release`). Every action is stored in `gate_events` and `events`.

### WebSocket

`ws://<host>:<PORT>/ws`. A snapshot is sent on connect, then updates:

```json
{ "event": "crossing.state", "data": { "crossing_id": "crossing-01", "state": "TUTUP", "fusion_score": 0.94, "barrier_status": "open", "close_deadline_at": "...", "devices": [], "device_faults": [] } }
{ "event": "sim.status",     "data": { "running": true, "scenario": "s3" } }
```

The full `crossing.state` payload is described in [../mobile/DESIGN.md](../mobile/DESIGN.md) section 8.6.

## Database

MongoDB is the single persistent store. Collections:

| Collection | Content |
|---|---|
| `operators` | Authorized operators (login validation) |
| `crossings` | Crossing status, including `barrier_status` |
| `devices` | Registered devices: the node and its four sensors |
| `sensors` | Demo sensor records |
| `hardware` | Free components reported over MQTT |
| `telemetry` | Demo time series |
| `node_readings` | Every accepted node message (raw values, scores, status) |
| `alerts` | Raised alerts |
| `events` | Activity and audit log |
| `gate_events` | Manual gate override audit trail |
| `network_nodes`, `network_links` | LoRa mesh topology |

On connect the backend creates indexes, seeds empty collections from `src/data/demoData.js`, and registers any missing sensor devices without touching existing documents. `database/init.mongo.js` can provision a database independently:

```bash
mongosh "<MONGODB_URI>/maw" database/init.mongo.js
```

Set `SEED_RESET=true` once to wipe and re-seed the data collections. Gate events are cleared too.

## Project layout

```
src/
  app.js              Express routes
  server.js           Start-up: database, decision engine, MQTT, WebSocket
  config/             db.js, mqtt.js (two connections), maw.js (env), nodeMap.json
  maw/                mawState.js (pure state machine), engine.js, runtime.js (wiring to
                      MongoDB, alerts, events), scenarios.js, simRunner.js
  realtime/ws.js      WebSocket server
  services/index.js   Data access (MongoDB or demo data)
  data/demoData.js    Demo dataset and seed
scripts/              mqtt-sim.js, mqtt-device.js, scenarios.json
tests/                Node test runner
```

`src/maw/mawState.js` has no imports and no I/O, so the same logic can run in the browser.

## Demo mode

Without `MONGODB_URI`, the API serves in-memory data from `src/data/demoData.js`. Everything works, but nothing is saved between restarts.

# MAW Dashboard (frontend)

React + Vite dashboard for the MAW (Monitoring, Alert, Warning) railway crossing system. It shows the live barrier instruction, alerts, device health and history. Every page reads from the backend; there is no mock data.

## Run

```bash
npm install
cp .env.example .env     # set VITE_API_URL if the backend is not on localhost:5000
npm run dev              # http://localhost:5173
```

Start the backend first (`cd ../backend && npm run dev`). Sign in with an operator email registered in the backend (for example `operator@maw.id`).

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | Oxlint |

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000/api` | Backend REST base URL |
| `VITE_WS_URL` | derived from `VITE_API_URL` (`ws://<host>:5000/ws`) | Live feed WebSocket |

Variables starting with `VITE_` are shipped to the browser. Keep secrets (MongoDB, MQTT credentials) in `backend/.env`.

## Pages

| Route | Content |
|---|---|
| `/dashboard` | Crossing watch (animated barrier, 20 s confirmation countdown, alarm), network status, priority alerts, recent activity |
| `/map` | Live map with crossing markers |
| `/crossings`, `/crossing/:id` | Crossing list and detail (barrier instruction, gate control, sensor node telemetry, events) |
| `/alerts` | Alert center (acknowledge, resolve) |
| `/events` | Event history |
| `/network` | LoRa mesh nodes |
| `/health` | Device health: registered devices from MongoDB, status updated over MQTT |
| `/simulation` | Runs scenarios (S3, S4, S5, train) on the backend, no hardware needed |
| `/settings` | Detection parameters currently enforced by the backend (read-only) |

## How data flows

```
Sensor node -> MQTT (mqx/node/data) -> backend decision engine
                                          |-> REST  /api/...   (src/services)
                                          '-> WebSocket /ws    (src/store/mawFeedStore.js)
```

- `src/store/mawFeedStore.js`: one shared WebSocket. Holds the latest `crossing.state` per crossing and raises the disconnected-device pop-up.
- `src/hooks/useCrossingsLive.js`: crossings from the API with the live state applied.
- `src/lib/adapters.js`: maps API records (snake_case) to what the components render.
- `src/components/watch/`: crossing watch panel, animated scene, device alerts.

A registered device that is `disconnected` puts its crossing in MANUAL CHECK (fail-safe). The dashboard then shows a pop-up and a banner, and the crossing scene is blocked until it reconnects.

# MAW - Monitoring, Alert, Warning

Smart Rail Guard: an IoT early warning system for unguarded railway level crossings.

A sensor node at the crossing fuses vibration, load, magnetic and sound readings into a **Fusion Score** and publishes it over MQTT. The backend turns that into one clear instruction for the guard: **close the barrier now**, **get ready**, or **the barrier may open**. The guard sees it on the MAW Petugas phone app, and operators see the same thing on the web dashboard.

The system never operates the barrier by itself. It only instructs; the guard closes it and confirms.

## What is in this repository

| Folder | What | Docs |
|---|---|---|
| [backend/](backend/) | Express.js + MongoDB API, MQTT ingest, decision engine, WebSocket | [backend/README.md](backend/README.md) |
| [frontend/](frontend/) | React + Vite operator dashboard | [frontend/README.md](frontend/README.md) |
| [mobile/](mobile/) | Expo / React Native app for the guard (MAW Petugas) | [mobile/README.md](mobile/README.md), [mobile/DESIGN.md](mobile/DESIGN.md) |

## How it works

```
Sensor node (ESP32) --LoRa--> Gateway --MQTT--> broker.emqx.io
                                                    |
              topic mqx/node/data (fusion score)    |   topic maw/hardware/... (device status)
                                                    v
                                  Backend (Express.js)
                                  - decision engine (state machine)
                                  - alerts, events, device status in MongoDB
                                      |                  |
                               REST /api/...       WebSocket /ws
                                      |                  |
                              Web dashboard        Mobile app (guard)
```

Barrier states, calculated once in the backend so every screen agrees:

| State | Meaning | Instruction |
|---|---|---|
| AMAN | Fusion Score below 0.40, data fresh | Barrier may open |
| SIAGA | 0.40 to 0.60 | Get ready to close |
| TUTUP | 0.60 or more, or the node reports DANGER | Close the barrier now, confirm within 20 s |
| MENUNGGU AMAN | Score is low again, 20 s hold running | Keep it closed |
| CEK MANUAL | Stale data, broker down, or a registered device is disconnected | Manual check, do not rely on the screen |

The rules (thresholds, hold time, fail-safe behaviour) are in [mobile/DESIGN.md](mobile/DESIGN.md).

## Quick start

Needs Node.js 20.19.4 or newer.

```bash
# 1. Backend  (http://localhost:5000)
cd backend
npm install
cp .env.example .env        # then fill MONGODB_URI (or leave empty for demo data)
npm run dev

# 2. Web dashboard  (http://localhost:5173)
cd frontend
npm install
cp .env.example .env
npm run dev

# 3. Mobile app  (scan the QR with Expo Go)
cd mobile
npm install
cp .env.example .env        # set EXPO_PUBLIC_API_URL to your laptop LAN IP
npm start
```

Sign in with an operator email registered in the backend, for example `operator@maw.id`.

## Try it without hardware

With the backend running, from `backend/`:

```bash
npm run s4      # SAFE     -> barrier may open
npm run s5      # WARNING  -> get ready to close
npm run s3      # DANGER   -> close the barrier now (alarm on phone and web)
npm run train   # a whole train passing, start to finish
```

These publish the same payloads the real node sends, through the real MQTT broker. The web Simulation Center page runs the same scenarios directly on the backend.

Device status can be changed the same way:

```bash
npm run disconnected_MPU6500    # crossing goes to manual check, alert and pop-up
npm run connected_MPU6500
```

Available devices: `ESP32`, `MPU6500`, `HX711`, `HMC5883L`, `MAX9814`.

## MQTT topics

| Topic | Payload | Used for |
|---|---|---|
| `mqx/node/data` | Fusion Score JSON from the node (see [mobile/DESIGN.md](mobile/DESIGN.md) section 8.1) | Barrier decisions |
| `maw/hardware/<crossing_id>/<device>` | `{"status": "connected"}` or `{"status": "disconnected"}` | Device health |

## Tests and checks

```bash
cd backend  && npm test               # decision engine, deadline, device faults
cd frontend && npm run build && npm run lint
cd mobile   && npm run typecheck && npm run doctor
```

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `GET /api/health` shows `db: demo` and the log says `SSL alert number 80` | MongoDB Atlas is rejecting this machine. Add your public IP in Atlas under Network Access, then restart the backend. |
| The phone cannot open the app or reach the backend | The laptop Wi-Fi is set to a Public network, so Windows blocks the ports. Set it to Private and allow ports 5000 and 8081. Use the laptop LAN IP, not `localhost`, in `mobile/.env`. |
| Phone app is stuck on CEK MANUAL | No fresh data in the last 15 s. Run `npm run s4` in `backend/`, or check that every registered device is connected. |

## Security notes

- The MongoDB URI and MQTT credentials live only in `backend/.env`, which is not committed.
- `broker.emqx.io` is a public broker without authentication. Use a unique topic prefix for your team, and a private broker with TLS and per-node credentials for field tests (see [mobile/DESIGN.md](mobile/DESIGN.md) section 9).
- Variables starting with `VITE_` or `EXPO_PUBLIC_` are shipped inside the web and mobile apps. Never put secrets there.

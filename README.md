# MAW — Monitoring, Alert, Warning

Smart Rail Guard — IoT Early Warning System for Unguarded Railway Level Crossings.

## Overview

The project consists of a **React/Vite frontend** (`maw-dashboard/`) and an **Express.js/MongoDB backend** (`backend/`) that together implement the monitoring, alert, and warning system for railway crossings.

## Quick Start

### 1. Run Frontend (demo mode)

```bash
cd maw-dashboard
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

### 2. Run Backend (demo mode)

```bash
cd backend
npm install
npm run dev
```

Backend runs at `http://localhost:5000/api`

### Mobile (Expo / React Native)

```bash
cd mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL (use your LAN IP on a physical phone)
npm start              # scan QR with Expo Go
```

### 3. Connect Frontend to Backend

Set in `maw-dashboard/.env`:
```
VITE_API_URL=http://localhost:5000/api
```

## Full Implementation (MongoDB)

1. Provision a MongoDB instance (local or MongoDB Atlas)
2. Set `MONGODB_URI` and `MONGODB_DB` in `backend/.env`
3. (Optional) Seed/provision: `mongosh "<MONGODB_URI>/maw" backend/database/init.mongo.js`
4. Restart backend — it creates indexes and seeds demo data on first connect

## Architecture

```
IoT / Simulation
    ↓
MQTT (future)
    ↓
Express.js (backend)
    ↓
MongoDB
    ↓
REST API + Demo Data
    ↓
React Frontend
```

## Key Features

- **Dashboard:** Real‑time system status, crossing alerts, fusion score
- **Crossing Monitoring:** List view, detail view, real‑time telemetry
- **Alert Center:** Filter, acknowledge, resolve
- **Live Map:** Leaflet OpenStreetMap with railway overlays
- **Network Topology:** LoRa Mesh visualization
- **Simulation Center:** Train‑approaching scenario demo
- **Device Health:** Hardware status, battery, connectivity
- **Event History:** Timeline view

## Documentation

- `agents.md` — primary requirements
- `frontend/MAW_UI_UX_GUIDELINES.md` — design system
- `backend_md/agents.md` — backend spec
- `cross-evaluate/IMPLEMENTATION_RULES.md` — cross‑layer rules

## Testing

Backend:

```bash
cd backend
npm test
```

Frontend lint/build:

```bash
cd maw-dashboard
npm run lint
npm run build
```

## Simulation Flow

1. Open `/simulation`
2. Select “Train Approaching”
3. Watch magnetic/vibration/acoustic detection stages
4. See alert generated, crossing status changes
5. Acknowledge and resolve the incident

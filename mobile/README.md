# MAW Petugas (mobile)

Expo / React Native app for the guard at a level crossing. One screen answers one question: **must I close the barrier now, or may I open it?**

It shows the instruction in a full-colour card, the Fusion Score with its thresholds, why the system decided that (each sensor's contribution), and today's history. It never opens or closes the barrier; the guard does, then confirms in the app.

The design and the safety rules are in [DESIGN.md](DESIGN.md). The app follows the same visual system as the web dashboard (IBM Plex, Space Grotesk, Lucide icons).

## Run

Needs Node.js 20.19.4 or newer and the Expo Go app on the phone. This project uses **Expo SDK 57**, so Expo Go must support SDK 57.

```bash
npm install
cp .env.example .env     # set EXPO_PUBLIC_API_URL
npm start                # scan the QR code with Expo Go
```

The backend must be running (`cd ../backend && npm run dev`). The phone and the laptop must be on the same Wi-Fi.

| Command | What it does |
|---|---|
| `npm start` | Dev server |
| `npm run android` / `ios` / `web` | Open on a device or emulator |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` |
| `npm run doctor` | `expo-doctor`, checks dependency versions |

After changing `.env`, restart with `npx expo start -c`.

## Environment

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend REST URL. Android emulator: `http://10.0.2.2:5000/api`. Physical phone: `http://<laptop LAN IP>:5000/api`. |
| `EXPO_PUBLIC_WS_URL` | Optional. Defaults to the API host at `/ws`. |
| `EXPO_PUBLIC_CROSSING_ID` | Optional. Pins this phone to one crossing. Empty uses the first crossing the backend reports. |

With a deployed backend use its public address: `EXPO_PUBLIC_API_URL=https://<backend>/api` (the WebSocket becomes `wss://<backend>/ws`). `localhost` on a phone means the phone itself, so use the laptop LAN IP. Variables starting with `EXPO_PUBLIC_` are shipped inside the app: no secrets here. The app talks to the backend only; it never connects to MongoDB or MQTT directly.

## Try it

1. Start the backend and the app, then sign in with an operator email, for example `operator@maw.id`.
2. The screen shows **CEK MANUAL** until data arrives. In `backend/`, run:

```bash
npm run s4      # PALANG BOLEH DIBUKA
npm run s5      # BERSIAP MENUTUP
npm run s3      # TUTUP PALANG SEKARANG: alarm, countdown, confirm button
```

Stop one scenario (Ctrl+C) before starting the next. If no data arrives for 15 s the screen goes back to CEK MANUAL on purpose: it never shows "may open" on stale data.

`npm run disconnected_MPU6500` (in `backend/`) puts the crossing in manual check with the cause "Perangkat terputus: MPU6500".

## What the screen shows

| State | Card | Alarm |
|---|---|---|
| AMAN | Green, "Palang boleh dibuka" | none (two rising tones when coming back from MENUNGGU AMAN) |
| SIAGA | Amber, "Bersiap menutup" | one beep and vibration |
| TUTUP | Red, flashing, "Tutup palang sekarang", 20 s confirm countdown, "Palang sudah ditutup" button | repeats every 3 s until confirmed |
| MENUNGGU AMAN | Red, "Tetap tutup", hold countdown | silent |
| CEK MANUAL | Grey with diagonal stripes, shows the cause and last known state | repeats every 10 s |

Fail-safe checks also run on the phone: if the WebSocket drops, or the newest data is older than the limit, the screen forces CEK MANUAL regardless of the last server state. The screen stays awake while the app is open.

## Known limits

- **Expo Go on Android has no system notifications** (the push module was removed in SDK 53). Sound and vibration alarms work; notifications and background alerts need a development build (`npx expo run:android` or `eas build --profile development`).
- Alarms only sound while the app is in the foreground, because the live connection is a WebSocket. Background alerts need server push plus a development build.

## Project layout

```
App.tsx                      Fonts, session, login or monitor screen
src/
  screens/                   LoginScreen, MonitorScreen
  components/                TopBar, InstructionCard, AckButton, FusionScoreBar,
                             SensorContribution, EventLog, ui/ (Card, StatusBadge)
  hooks/                     useDisplayState (fail-safe), useAlarms, useEventLog, useNow
  services/                  api.ts (REST), mawSocket.ts (WebSocket with reconnect)
  store/                     useMawStore (live state), useAuthStore (operator session)
  theme/                     tokens.ts, fonts.ts
  lib/                       format.ts (Indonesian number and time format), notifications.ts
  types/maw.ts               Shape of the crossing.state message
assets/sounds/               Alarm tones
```

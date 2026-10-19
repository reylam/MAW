import { WebSocketServer } from 'ws';
import { getEngine } from '../maw/runtime.js';
import * as simRunner from '../maw/simRunner.js';

/*
  WebSocket channel for petugas and web clients (DESIGN.md 8.6).
  URL: ws://<host>:<PORT>/ws
  Server -> client:
    { "event": "crossing.state", "data": { ...8.6 payload } }
    { "event": "sim.status", "data": { running, scenario, label, ... } }
  A snapshot of every crossing (and the simulation status) is sent on
  connect. Pings every 10 s let both sides notice a dead connection.
*/

let wss = null;

export function initWebSocket(server) {
  const engine = getEngine();
  wss = new WebSocketServer({ server, path: '/ws' });

  const send = (ws, event, data) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ event, data }));
  };
  const broadcast = (event, data) => { for (const ws of wss.clients) send(ws, event, data); };

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    for (const state of engine.listStates()) send(ws, 'crossing.state', state);
    send(ws, 'sim.status', simRunner.status());
  });

  const unsubscribeEngine = engine.subscribe((state) => broadcast('crossing.state', state));
  const unsubscribeSim = simRunner.subscribe((status) => broadcast('sim.status', status));
  const unsubscribe = () => { unsubscribeEngine(); unsubscribeSim(); };

  const pinger = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 10000);

  wss.on('close', () => { clearInterval(pinger); unsubscribe(); });
  console.log('WebSocket ready on /ws');
  return wss;
}

export function closeWebSocket() {
  if (wss) wss.close();
  wss = null;
}

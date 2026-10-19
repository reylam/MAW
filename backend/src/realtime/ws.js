import { WebSocketServer } from 'ws';
import { getEngine } from '../maw/runtime.js';

/*
  WebSocket channel for petugas clients (DESIGN.md 8.6).
  URL: ws://<host>:<PORT>/ws
  Server -> client: { "event": "crossing.state", "data": { ...8.6 payload } }
  A snapshot of every crossing is sent on connect. Pings every 10 s let both
  sides notice a dead connection.
*/

let wss = null;

export function initWebSocket(server) {
  const engine = getEngine();
  wss = new WebSocketServer({ server, path: '/ws' });

  const send = (ws, data) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ event: 'crossing.state', data }));
  };

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    for (const state of engine.listStates()) send(ws, state);
  });

  const unsubscribe = engine.subscribe((state) => {
    for (const ws of wss.clients) send(ws, state);
  });

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

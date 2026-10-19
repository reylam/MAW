import 'dotenv/config';
import mqtt from 'mqtt';
import { loadScenarios, scenarioPayload } from '../src/maw/scenarios.js';

/*
  Pretend to be the Gateway Node: publish DESIGN.md 8.1 payloads to the broker
  (MQTT_URL / MAW_NODE_TOPIC from backend/.env) so the whole
  MQTT -> backend -> app path can be tested without hardware.

  Scenario payloads live in scripts/scenarios.json. To add one, paste the
  firmware payload there under a new key (e.g. "s6") and run it.

  Usage (from backend/):
    npm run s3                  # S3 >> Bahaya   (DANGER)  -> TUTUP
    npm run s4                  # S4 >> Safe     (SAFE)    -> AMAN
    npm run s5                  # S5 >> Warning  (WARNING) -> SIAGA
    npm run train               # kereta lewat: AMAN, SIAGA, TUTUP, MENUNGGU AMAN, AMAN
    npm run sim -- s6           # any key from scenarios.json
    npm run sim -- s3 once      # send one message and exit (no heartbeat)

  Every HEARTBEAT (5 s) the scenario is re-sent with a fresh timestamp, as real
  firmware must do; otherwise the app falls back to CEK MANUAL after 15 s.
  Stop with Ctrl+C.
*/

const url = process.env.MQTT_URL || 'wss://broker.emqx.io:8084/mqtt';
const topic = process.env.MAW_NODE_TOPIC || 'mqx/node/data';
const heartbeatMs = Number(process.env.MAW_HEARTBEAT_S || 5) * 1000;
const [mode = 'train', repeat] = process.argv.slice(2);
const once = repeat === 'once';

const scenarios = loadScenarios();

if (!scenarios[mode]) {
  console.error(`Scenario "${mode}" not found. Available: ${Object.keys(scenarios).join(', ')}`);
  process.exit(1);
}

const label = scenarios[mode].label || mode;
const client = mqtt.connect(url, { clientId: `maw-sim-${Math.random().toString(16).slice(2, 8)}` });

client.on('connect', () => {
  console.log(`${label}  ->  ${topic}  (${url})${once ? '' : `, tiap ${heartbeatMs / 1000} dtk, Ctrl+C untuk berhenti`}`);
  let seq = 0;
  const send = (done) => {
    const p = scenarioPayload(scenarios, mode, seq);
    if (process.env.NODE_ID) p.node_id = process.env.NODE_ID;
    seq++;
    client.publish(topic, JSON.stringify(p), { qos: 1 }, (err) => {
      if (err) console.error('Publish failed:', err.message);
      else console.log(`${new Date().toLocaleTimeString('id-ID')}  ${p.node_id}  fusion ${p.fusion_score.toFixed(2)}  ${p.status}`);
      done?.();
    });
  };
  if (once) {
    send(() => client.end());
    return;
  }
  send();
  setInterval(send, heartbeatMs);
});

client.on('error', (e) => { console.error('MQTT error:', e.message); process.exitCode = 1; });
process.on('SIGINT', () => { client.end(); process.exit(0); });

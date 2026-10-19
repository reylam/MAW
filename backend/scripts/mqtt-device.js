import 'dotenv/config';
import mqtt from 'mqtt';

/*
  Set the status of one device by publishing it to the hardware MQTT topic, as
  MQTTX would. From backend/:

    npm run connected_MPU6500        npm run disconnected_MPU6500
    npm run connected_HX711          npm run disconnected_HX711
    npm run connected_HMC5883L       npm run disconnected_HMC5883L
    npm run connected_MAX9814        npm run disconnected_MAX9814
    npm run connected_ESP32          npm run disconnected_ESP32

  Publishes {"status": "<status>"} to <MQTT_TOPIC_ROOT>/<crossing>/<device>
  on HARDWARE_MQTT_URL (falls back to MQTT_URL). The backend updates the
  device in MongoDB; a disconnected device puts the crossing in MANUAL CHECK,
  raises an alert and shows a pop-up on the website.
*/

const DEVICES = ['MPU6500', 'HX711', 'HMC5883L', 'MAX9814', 'ESP32'];
const [status, deviceArg] = process.argv.slice(2);
const device = DEVICES.find((d) => d.toLowerCase() === String(deviceArg).toLowerCase());

if (!['connected', 'disconnected'].includes(status) || !device) {
  console.error(`Usage: node scripts/mqtt-device.js <connected|disconnected> <${DEVICES.join('|')}>`);
  process.exit(1);
}

const url = process.env.HARDWARE_MQTT_URL || process.env.MQTT_URL || 'mqtt://broker.emqx.io:1883';
const root = process.env.MQTT_TOPIC_ROOT || 'maw/hardware';
const crossing = process.env.CROSSING_ID || 'crossing-01';
const topic = `${root}/${crossing}/${device.toLowerCase()}`;

const client = mqtt.connect(url, { clientId: `maw-device-${Math.random().toString(16).slice(2, 8)}` });
client.on('connect', () => {
  client.publish(topic, JSON.stringify({ status }), { qos: 1 }, (err) => {
    console.log(err ? `Publish failed: ${err.message}` : `${device} -> ${status}   (${topic} @ ${url})`);
    client.end(false, () => process.exit(err ? 1 : 0));
  });
});
client.on('error', (e) => { console.error('MQTT error:', e.message); process.exit(1); });
setTimeout(() => { console.error('Timed out connecting to the broker.'); process.exit(1); }, 15000);

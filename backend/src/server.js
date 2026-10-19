import app from './app.js';
import { connectDB, closeDB } from './config/db.js';
import { initMqtt, closeMqtt } from './config/mqtt.js';

const port = Number(process.env.PORT || 5000);

// Establish the MongoDB connection before accepting traffic. If no database is
// configured the backend still starts and serves demo data.
await connectDB();

// Subscribe to hardware MQTT (if MQTT_URL is configured) so component health
// reported by field devices is mirrored into MongoDB and shown on the web.
initMqtt();

const server = app.listen(port, () => console.log(`MAW API listening on ${port}`));

async function shutdown() {
  closeMqtt();
  await closeDB();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

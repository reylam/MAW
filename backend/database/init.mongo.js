/*
  MAW - MongoDB initialization script.

  Run against your MongoDB instance to create indexes and seed the operator
  roster:

    mongosh "<MONGODB_URI>/maw" database/init.mongo.js

  Note: the backend also creates these indexes and seeds demo data
  automatically on first connect (see src/config/db.js). This script is
  provided for provisioning a database independently of the app.

  Collections:
    operators         - authorized operators (login validation)
    crossings         - level crossing status (incl. barrier_status)
    devices           - field sensor nodes / gateways
    sensors           - individual sensors per device
    hardware          - hardware components per crossing (Device Health)
    telemetry         - time-series sensor readings
    alerts            - raised alerts
    events            - activity / audit log
    gate_events       - manual gate-control actions (override audit trail)
*/

const collections = [
  'operators', 'crossings', 'devices', 'sensors', 'hardware',
  'telemetry', 'alerts', 'events', 'gate_events',
];

for (const name of collections) {
  if (!db.getCollectionNames().includes(name)) {
    db.createCollection(name);
    print(`Created collection: ${name}`);
  }
}

// Indexes
db.operators.createIndex({ email: 1 }, { unique: true });
db.crossings.createIndex({ id: 1 }, { unique: true });
db.devices.createIndex({ id: 1 }, { unique: true });
db.sensors.createIndex({ id: 1 }, { unique: true });
db.hardware.createIndex({ id: 1 }, { unique: true });
db.hardware.createIndex({ crossing_id: 1 });
db.telemetry.createIndex({ crossing_id: 1, recorded_at: -1 });
db.alerts.createIndex({ severity: 1, status: 1 });
db.events.createIndex({ occurred_at: -1 });
db.gate_events.createIndex({ crossing_id: 1, timestamp: -1 });

// Seed authorized operators (idempotent via upsert on email).
const operators = [
  { id: 'op-001', email: 'operator@maw.id', name: 'Operator', role: 'operator', active: true },
  { id: 'op-002', email: 'operator@example.com', name: 'Operator', role: 'operator', active: true },
  { id: 'op-003', email: 'reynaldo@maw.id', name: 'Reynaldo', role: 'supervisor', active: true },
  { id: 'op-004', email: 'control@maw.id', name: 'Control Room', role: 'operator', active: true },
];

for (const op of operators) {
  db.operators.updateOne({ email: op.email }, { $set: op }, { upsert: true });
}
print(`Seeded ${operators.length} operators`);

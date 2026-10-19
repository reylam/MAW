const now = new Date().toISOString();

// MAW is deployed as a single pilot crossing. Everything below (device, sensors,
// hardware, telemetry, network node) derives from this one crossing.
const crossings = [
  ['crossing-01','CRS-001','Crossing #01','Jalan Sutoyo, Jakarta Timur','Jakarta-Bandung Main Line','Jalan Sutoyo','safe',false,'open',false,-65,9.2],
].map(([id,code,name,location_name,railway_line,road_name,status,train_detected,barrier_status,obstacle_detected,rssi,snr], index) => ({ id, code, name, location_name, railway_line, road_name, status, train_detected, barrier_status, obstacle_detected, rssi, snr, connectivity: 'connected', risk_score: status === 'critical' ? 92 : status === 'warning' ? 58 : 20, risk_level: status === 'critical' ? 'critical' : status === 'warning' ? 'medium' : 'low', latitude: -6.169 - index * 0.01, longitude: 106.83 - index * 0.01, last_updated_at: now }));
const devices = crossings.map((crossing, index) => ({ id: `device-${index + 1}`, device_code: `ESP32-CROSSING-0${index + 1}`, device_type: 'sensor_node', crossing_id: crossing.id, status: crossing.connectivity, firmware_version: '1.2.0', battery_level: 100 - index * 7, rssi: crossing.rssi, snr: crossing.snr, packet_loss: 0.5, latency: 120, uptime_seconds: 864000, last_seen_at: now }));
const sensors = devices.flatMap((device) => [['MPU6050','vibration','g',0.75],['HALL_EFFECT','magnetic_field','µT',40],['MAX9814','sound_level','dB',70]].map(([sensor_type,metric,unit,threshold], index) => ({ id: `${device.id}-sensor-${index + 1}`, sensor_code: `${sensor_type}-${device.device_code}`, sensor_type, device_id: device.id, crossing_id: device.crossing_id, metric, status: 'online', threshold, unit, last_value: index + 0.12, last_updated_at: now })));
const alerts = [{ id:'alert-003', alert_code:'ALT-003', crossing_id:'crossing-01', device_id:'device-1', severity:'warning', alert_type:'vibration', title:'Abnormal Vibration', message:'Getaran abnormal terdeteksi pada sensor', status:'active', triggered_at:now }];
const telemetry = sensors.flatMap((sensor) => Array.from({ length: 24 }, (_, index) => ({ id:`${sensor.id}-${index}`, sensor_id:sensor.id, device_id:sensor.device_id, crossing_id:sensor.crossing_id, metric:sensor.metric, value:Number((sensor.last_value + index / 20).toFixed(2)), unit:sensor.unit, recorded_at:new Date(Date.now() - (24-index) * 300000).toISOString() })));
const networkNodes = [
  { id:'gateway-01', device_id:null, crossing_id:null, node_id:'NODE-GATEWAY-01', name:'Gateway Central', node_type:'gateway', status:'online', rssi:null, snr:null, battery:100, last_seen_at:now },
  ...devices.map((device, index) => ({ id:`node-${index + 1}`, device_id:device.id, crossing_id:device.crossing_id, node_id:`NODE-RAIL-0${index + 1}`, name:device.device_code, node_type:'sensor', status:'online', rssi:device.rssi, snr:device.snr, battery:device.battery_level, last_seen_at:now })),
];

// Device Health is driven entirely by real hardware reporting over MQTT (see
// src/config/mqtt.js). We intentionally ship NO demo hardware so the page only
// ever shows components that have actually connected and published.
const hardware = [];
// Authorized operators. In a real deployment this lives in the database / identity provider.
// The full list is never exposed to the frontend - only validation results are returned.
const operators = [
  { id:'op-001', email:'operator@maw.id', name:'Operator', role:'operator', active:true },
  { id:'op-002', email:'operator@example.com', name:'Operator', role:'operator', active:true },
  { id:'op-003', email:'reynaldo@maw.id', name:'Reynaldo', role:'supervisor', active:true },
  { id:'op-004', email:'control@maw.id', name:'Control Room', role:'operator', active:true },
];
export const data = { crossings, devices, sensors, hardware, telemetry, alerts, operators, incidents:[], events:alerts.map((alert) => ({ id:`event-${alert.id}`, event_type:alert.alert_type, severity:alert.severity, crossing_id:alert.crossing_id, title:alert.title, description:alert.message, occurred_at:alert.triggered_at })), maintenance:[], networkNodes, networkLinks:networkNodes.slice(1).map((node) => ({ id:`link-${node.id}`, source_node_id:'gateway-01', target_node_id:node.id, rssi:node.rssi, snr:node.snr, status:'online' })) };

export const mockCrossings = [
  {
    id: 'crossing-01',
    name: 'Crossing #01',
    location: 'Jalan Sutoyo, Jakarta Timur',
    coordinates: { lat: -6.169, lng: 106.830 },
    railwayLine: 'Jakarta-Bandung Main Line',
    roadName: 'Jalan Sutoyo',
    status: 'safe',
    trainDetected: false,
    barrierStatus: 'open',
    obstacleDetected: false,
    lastUpdate: new Date(Date.now() - 3000).toISOString(),
    sensors: {
      vibration: 0.12,
      magnetic: 0.08,
      acoustic: 0.15,
    },
    connectivity: 'connected',
    rssi: -65,
    snr: 9.2,
  },
];

export const mockAlerts = [
  {
    id: 'alert-003',
    crossingId: 'crossing-01',
    type: 'warning',
    title: 'Abnormal Vibration',
    description: 'Getaran abnormal terdeteksi pada sensor',
    timestamp: new Date(Date.now() - 45000).toISOString(),
    resolved: false,
  },
  {
    id: 'alert-004',
    crossingId: 'crossing-01',
    type: 'system',
    title: 'Barrier Maintenance',
    description: 'Barrier pada perlintasan #01 memerlukan pemeliharaan',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    resolved: true,
  },
];

export const mockLoRaMesh = [
  {
    nodeId: 'node-gateway-01',
    name: 'Gateway Central',
    type: 'gateway',
    status: 'online',
    parent: null,
    children: ['node-sensor-01', 'node-sensor-02', 'node-warning-01'],
    rssi: 0,
    snr: 0,
    battery: 100,
  },
  {
    nodeId: 'node-sensor-01',
    name: 'Sensor Crossing #01',
    type: 'sensor',
    status: 'online',
    parent: 'node-gateway-01',
    children: [],
    rssi: -65,
    snr: 9.2,
    battery: 85,
  },
  {
    nodeId: 'node-sensor-02',
    name: 'Sensor Crossing #03',
    type: 'sensor',
    status: 'online',
    parent: 'node-gateway-01',
    children: [],
    rssi: -58,
    snr: 12.4,
    battery: 72,
  },
  {
    nodeId: 'node-warning-01',
    name: 'Warning Crossing #03',
    type: 'warning',
    status: 'online',
    parent: 'node-gateway-01',
    children: [],
    rssi: -62,
    snr: 10.8,
    battery: 91,
  },
];

export const mockEventTimeline = [
  {
    id: 'evt-003',
    timestamp: new Date(Date.now() - 45000).toISOString(),
    type: 'warning',
    title: 'Abnormal Vibration',
    crossing: 'Crossing #01',
    description: 'Sensor vibration mendeteksi anomali',
  },
  {
    id: 'evt-004',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    type: 'system',
    title: 'System Online',
    crossing: 'Crossing #01',
    description: 'Perlintasan dalam status normal',
  },
];

export const mockSystemStats = {
  totalCrossings: 1,
  safe: 1,
  warning: 0,
  critical: 0,
  offline: 0,
  uptime: 99.8,
};

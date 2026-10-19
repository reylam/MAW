// Map backend (snake_case) API records to the shape the UI components render.
// Raw fields are kept so components can still read either form.

// MAW barrier state -> dashboard status vocabulary.
export const MAW_STATUS = { AMAN: 'safe', SIAGA: 'warning', TUTUP: 'critical', MENUNGGU_AMAN: 'critical', CEK_MANUAL: 'offline' };

// Node sensors (DESIGN.md 5.3), in display order.
export const NODE_SENSORS = [
  { field: 'v_norm', raw: 'getaran_mpu6500', label: 'Vibration', hw: 'MPU6500', color: '#005AA9' },
  { field: 'l_norm', raw: 'beban_hx711', label: 'Load', hw: 'Load Cell HX711', color: '#7C3AED' },
  { field: 'm_norm', raw: 'magnet_hmc5883l', label: 'Magnetic', hw: 'HMC5883L', color: '#0F8A5F' },
  { field: 's_norm', raw: 'suara_max9814', label: 'Acoustic', hw: 'MAX9814', color: '#F58220' },
];

export function toCrossing(raw) {
  return {
    ...raw,
    location: raw.location_name ?? raw.location ?? '',
    coordinates: { lat: Number(raw.latitude), lng: Number(raw.longitude) },
    railwayLine: raw.railway_line ?? null,
    roadName: raw.road_name ?? null,
    trainDetected: Boolean(raw.train_detected),
    barrierStatus: raw.barrier_status ?? 'unknown',
    obstacleDetected: Boolean(raw.obstacle_detected),
    lastUpdate: raw.last_updated_at ?? raw.updated_at ?? null,
    sensors: {},
  };
}

/*
  Overlay the live MAW state (WebSocket) on a crossing record so every page
  shows the same status as the petugas app without waiting for a refetch.
  A crossing without a sensor node keeps its stored status.
*/
export function applyLive(crossing, live) {
  if (!live) return crossing;
  const sensors = Object.fromEntries((live.contributions || []).map((c) => [c.field, c.value]));
  return {
    ...crossing,
    status: MAW_STATUS[live.state] ?? crossing.status,
    mawState: live.state,
    trainDetected: live.state === 'TUTUP' || live.state === 'MENUNGGU_AMAN',
    fusionScore: live.fusion_score,
    nodeId: live.node.node_id,
    lastUpdate: live.received_at ?? crossing.lastUpdate,
    sensors,
  };
}

export function hasValidCoordinates(crossing) {
  const { lat, lng } = crossing.coordinates || {};
  return Number.isFinite(lat) && Number.isFinite(lng);
}

export function toAlert(raw) {
  const type = raw.severity === 'critical' ? 'critical' : raw.severity === 'warning' ? 'warning' : 'system';
  return {
    ...raw,
    crossingId: raw.crossing_id,
    type,
    description: raw.message ?? raw.description ?? '',
    timestamp: raw.triggered_at,
    resolved: raw.status === 'resolved',
  };
}

// Map backend severities / event types to the shared status vocabulary.
export function eventStatus(ev) {
  if (ev.severity === 'critical') return 'critical';
  if (ev.severity === 'warning' || /gate|override/.test(ev.event_type || '')) return 'warning';
  return 'safe';
}

export function toNode(raw) {
  return {
    ...raw,
    nodeId: raw.node_id ?? raw.id,
    type: raw.node_type,
  };
}

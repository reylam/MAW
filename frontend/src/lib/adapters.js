// Map backend (snake_case) API records to the shape the UI components render.
// Raw fields are kept so components can still read either form.

// Telemetry metric name (backend) -> sensor key (UI).
export const METRIC_KEYS = {
  vibration: 'vibration',
  magnetic_field: 'magnetic',
  sound_level: 'acoustic',
};

// Latest value per sensor key from a list of telemetry rows.
export function latestSensors(telemetry = []) {
  const latest = {};
  for (const row of telemetry) {
    const key = METRIC_KEYS[row.metric];
    if (!key) continue;
    if (!latest[key] || new Date(row.recorded_at) > new Date(latest[key].recorded_at)) latest[key] = row;
  }
  return Object.fromEntries(Object.entries(latest).map(([k, row]) => [k, Number(row.value)]));
}

export function toCrossing(raw, telemetry = []) {
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
    sensors: latestSensors(telemetry.filter((t) => t.crossing_id === raw.id)),
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

// Fusion Score helpers, aligned with mobile/DESIGN.md (4 sensors, T_TUTUP 0.60).
// The authoritative calculation runs in the backend (backend/src/maw/mawState.js).

export const DEFAULT_WEIGHTS = { v_norm: 0.35, l_norm: 0.3, m_norm: 0.2, s_norm: 0.15 };
export const DEFAULT_THRESHOLD = 0.6;

export function calculateFusionScore(normalisasi, weights = DEFAULT_WEIGHTS) {
  return Object.keys(weights).reduce((sum, field) => sum + (normalisasi[field] ?? 0) * weights[field], 0);
}

export function normalizeSensorValue(rawValue, min, max) {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (rawValue - min) / (max - min)));
}

export function evaluateDecision(fusionScore, threshold = DEFAULT_THRESHOLD) {
  return fusionScore >= threshold ? 'TRAIN_DETECTED' : 'NO_TRAIN';
}

export function validateWeights(weights) {
  const sum = Object.values(weights).reduce((a, w) => a + w, 0);
  return Math.abs(sum - 1.0) < 0.001;
}

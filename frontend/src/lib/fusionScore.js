export function calculateFusionScore(vibration, magnetic, acoustic, weights) {
  const { vibration: wV, magnetic: wM, acoustic: wA } = weights;
  return (wV * vibration) + (wM * magnetic) + (wA * acoustic);
}

export function normalizeSensorValue(rawValue, min, max) {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (rawValue - min) / (max - min)));
}

export function evaluateDecision(fusionScore, threshold) {
  return fusionScore >= threshold ? 'TRAIN_DETECTED' : 'NO_TRAIN';
}

export function validateWeights(weights) {
  const sum = weights.vibration + weights.magnetic + weights.acoustic;
  return Math.abs(sum - 1.0) < 0.001;
}

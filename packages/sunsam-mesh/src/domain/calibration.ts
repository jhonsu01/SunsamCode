/**
 * Métricas de calibración del router (reglas de puntuación estrictamente propias, las mismas que
 * usa RLCD para entrenar Laya). Sirven para vigilar la deriva del router y ajustar el umbral.
 */

export interface LabeledDecision {
  /** Probabilidad predicha de que el tier local resuelva la petición. */
  pLocal: number;
  /** Resultado observado: true si el tier local fue suficiente. */
  localSufficient: boolean;
}

interface CalibrationReport {
  count: number;
  brier: number | null;
  logScore: number | null;
  expectedCalibrationError: number | null;
}

const EPSILON = 1e-6;

export function calibrationReport(
  decisions: readonly LabeledDecision[],
  bins = 10,
): CalibrationReport {
  if (decisions.length === 0) {
    return { count: 0, brier: null, logScore: null, expectedCalibrationError: null };
  }
  let brier = 0;
  let logScore = 0;
  const binTotals = Array.from({ length: bins }, () => ({ count: 0, predicted: 0, observed: 0 }));
  for (const decision of decisions) {
    const p = Math.min(1 - EPSILON, Math.max(EPSILON, decision.pLocal));
    const y = decision.localSufficient ? 1 : 0;
    brier += (p - y) ** 2;
    logScore += y === 1 ? Math.log(p) : Math.log(1 - p);
    const bin = binTotals[Math.min(bins - 1, Math.floor(p * bins))]!;
    bin.count += 1;
    bin.predicted += p;
    bin.observed += y;
  }
  const ece = binTotals.reduce(
    (sum, bin) =>
      bin.count === 0
        ? sum
        : sum +
          (bin.count / decisions.length) *
            Math.abs(bin.predicted / bin.count - bin.observed / bin.count),
    0,
  );
  return {
    count: decisions.length,
    brier: brier / decisions.length,
    logScore: logScore / decisions.length,
    expectedCalibrationError: ece,
  };
}

/**
 * Umbral mínimo cuya precisión observada en local (fracción de aciertos entre las peticiones con
 * p ≥ umbral) alcanza `targetPrecision`. `null` si no hay suficientes datos.
 */
export function suggestThreshold(
  decisions: readonly LabeledDecision[],
  targetPrecision = 0.9,
  minSupport = 20,
): number | null {
  const sorted = [...decisions].sort((left, right) => right.pLocal - left.pLocal);
  let hits = 0;
  let best: number | null = null;
  sorted.forEach((decision, index) => {
    hits += decision.localSufficient ? 1 : 0;
    const support = index + 1;
    if (support >= minSupport && hits / support >= targetPrecision) best = decision.pLocal;
  });
  return best;
}

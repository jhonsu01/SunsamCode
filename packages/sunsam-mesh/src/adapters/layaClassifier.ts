/**
 * Clasificador Laya (convaiinnovations/laya): modelo System-1 no autoregresivo que responde
 * preguntas tipadas con probabilidades calibradas (entrenado con RLCD, reglas de puntuación
 * propias). Se sirve con `pip install "laya[serve]"` → `POST /v1/systemone`.
 * Si no responde a tiempo, se usa la heurística (la petición nunca espera a Laya más de timeoutMs).
 */
import type { Classifier, ClassifierResult, MeshLogger } from "../app/ports.js";
import {
  heuristicLocalProbability,
  type HeuristicWeights,
  type RequestFeatures,
} from "../domain/complexity.js";
import { LAYA_ROUTE_QUESTIONS, layaRouteState } from "../domain/teacherSignals.js";

interface LayaAnswer {
  choice?: string;
  probabilities?: Record<string, number>;
}

export class LayaClassifier implements Classifier {
  constructor(
    private readonly options: {
      url: string;
      apiKey?: string;
      timeoutMs: number;
      heuristicBias: number;
      heuristicWeights: HeuristicWeights;
    },
    private readonly logger: MeshLogger,
  ) {}

  async classify(features: RequestFeatures): Promise<ClassifierResult> {
    try {
      const response = await fetch(`${this.options.url}/v1/systemone`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
        body: JSON.stringify({ state: layaRouteState(features), questions: LAYA_ROUTE_QUESTIONS }),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as { answers?: { route?: LayaAnswer } };
      const probabilities = payload.answers?.route?.probabilities;
      const local = probabilities?.local;
      if (typeof local !== "number" || !Number.isFinite(local))
        throw new Error("respuesta Laya sin route.probabilities.local");
      return { pLocal: Math.min(1, Math.max(0, local)), classifier: "laya" };
    } catch (error) {
      this.logger.warn("Laya no disponible; se usa la heurística", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        pLocal: heuristicLocalProbability(
          features,
          this.options.heuristicBias,
          this.options.heuristicWeights,
        ),
        classifier: "heuristic-fallback",
      };
    }
  }
}

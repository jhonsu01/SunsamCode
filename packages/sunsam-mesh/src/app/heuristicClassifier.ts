import {
  DEFAULT_HEURISTIC_WEIGHTS,
  heuristicLocalProbability,
  type HeuristicWeights,
  type RequestFeatures,
} from "../domain/complexity.js";
import type { Classifier, ClassifierResult } from "./ports.js";

/** Clasificador por defecto, sin dependencias ni red. */
export class HeuristicClassifier implements Classifier {
  constructor(
    private readonly bias = 0,
    private readonly weights: HeuristicWeights = DEFAULT_HEURISTIC_WEIGHTS,
  ) {}

  async classify(features: RequestFeatures): Promise<ClassifierResult> {
    return {
      pLocal: heuristicLocalProbability(features, this.bias, this.weights),
      classifier: "heuristic",
    };
  }
}

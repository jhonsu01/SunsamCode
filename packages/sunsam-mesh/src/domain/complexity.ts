/**
 * Clasificador heurístico "cero latencia": estima p_local = P(un modelo pequeño local resuelve bien
 * la petición). Es el fallback sin dependencias del clasificador Laya (probabilidades calibradas).
 */
import { type ApiFormat, contentHasImage, readMessages, readToolCount } from "./requestShape.js";

export interface RequestFeatures {
  /** Bytes UTF-8 del último mensaje de usuario con texto. */
  userBytes: number;
  /** Bytes UTF-8 de toda la conversación (incluido el system prompt). */
  conversationBytes: number;
  messageCount: number;
  codeBlocks: number;
  complexHits: number;
  simpleHits: number;
  hasImage: boolean;
  toolCount: number;
  /** Último texto de usuario (truncado) para clasificadores externos. */
  userText: string;
}

const COMPLEX_PATTERNS = [
  /refactor/i,
  /arquitect|architect/i,
  /diseñ|design/i,
  /migra/i,
  /debug|depur/i,
  /race condition|concurren/i,
  /optimi[sz]|rendimiento|performance/i,
  /multi[- ]?file|varios archivos|many files/i,
  /prove|demuestr|proof/i,
  /algorit/i,
  /segurid|security|vulnerab/i,
  /end[- ]to[- ]end|e2e/i,
  /implement/i,
  /from scratch|desde cero/i,
  /tests?\b|pruebas/i,
];

const SIMPLE_PATTERNS = [
  /explain|expl[ií]ca/i,
  /what is|qu[eé] es/i,
  /renam|renombr/i,
  /typo|errata/i,
  /format/i,
  /translat|traduc/i,
  /summari[sz]|resum/i,
  /one[- ]liner|una l[ií]nea/i,
  /comment|comenta/i,
];

const encoder = new TextEncoder();
const MAX_USER_TEXT = 4000;

function countMatches(text: string, patterns: readonly RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

export function extractRequestFeatures(body: unknown, format: ApiFormat): RequestFeatures {
  const messages = readMessages(body, format);
  const lastUser = [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.text);
  const userText = lastUser?.text ?? "";
  const rawMessages =
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as { messages?: unknown }).messages)
      ? ((body as { messages: Array<{ content?: unknown }> }).messages ?? [])
      : [];
  return {
    userBytes: encoder.encode(userText).length,
    conversationBytes: messages.reduce(
      (sum, message) => sum + encoder.encode(message.text).length,
      0,
    ),
    messageCount: messages.length,
    codeBlocks: Math.floor((userText.match(/```/g)?.length ?? 0) / 2),
    complexHits: countMatches(userText, COMPLEX_PATTERNS),
    simpleHits: countMatches(userText, SIMPLE_PATTERNS),
    hasImage: rawMessages.some((message) => contentHasImage(message?.content)),
    toolCount: readToolCount(body),
    userText: userText.slice(0, MAX_USER_TEXT),
  };
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

/**
 * Pesos del modelo logístico. Los valores por defecto están ajustados a mano; el script
 * `python/distill_router_weights.py` los re-ajusta con las etiquetas blandas del teacher/Laya
 * (destilación a un router de latencia cero) y se cargan con `router.heuristicWeights`.
 */
export interface HeuristicWeights {
  intercept: number;
  userBytes: number;
  conversationBytes: number;
  codeBlocks: number;
  complexHits: number;
  simpleHits: number;
  hasImage: number;
  toolCount: number;
}

export const DEFAULT_HEURISTIC_WEIGHTS: HeuristicWeights = {
  intercept: 2.2,
  userBytes: -0.9,
  conversationBytes: -0.35,
  codeBlocks: -0.6,
  complexHits: -0.9,
  simpleHits: 0.7,
  hasImage: -1,
  toolCount: -0.15,
};

/** Vector de entrada del modelo logístico (mismo orden y transformaciones que el script Python). */
function heuristicFeatureVector(features: RequestFeatures): Omit<HeuristicWeights, "intercept"> {
  return {
    userBytes: Math.log2(1 + features.userBytes / 400),
    conversationBytes: Math.log2(1 + features.conversationBytes / 20_000),
    codeBlocks: Math.min(features.codeBlocks, 3),
    complexHits: Math.min(features.complexHits, 3),
    simpleHits: Math.min(features.simpleHits, 2),
    hasImage: features.hasImage ? 1 : 0,
    toolCount: Math.log2(1 + features.toolCount),
  };
}

/** p_local = sigmoid(w·x + intercept + bias); `bias` desplaza el reparto local/swarm. */
export function heuristicLocalProbability(
  features: RequestFeatures,
  bias = 0,
  weights: HeuristicWeights = DEFAULT_HEURISTIC_WEIGHTS,
): number {
  const vector = heuristicFeatureVector(features);
  const z = (Object.keys(vector) as Array<keyof typeof vector>).reduce(
    (sum, key) => sum + weights[key] * vector[key],
    weights.intercept + bias,
  );
  return sigmoid(z);
}

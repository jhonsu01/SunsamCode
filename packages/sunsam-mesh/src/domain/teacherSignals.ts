/**
 * Señales del teacher para destilación:
 * - Dataset byte-level (End-Of-Token / Marginalize-It) desde `logprobs.content` de OpenAI.
 * - Etiquetas blandas para destilar un router Laya propio, vía distribución del primer byte
 *   (exacta e independiente del tokenizador del teacher).
 */
import {
  type BytePosition,
  type TokenCandidate,
  endOfTokenByteDistributions,
  firstByteLabelDistribution,
  marginalizeItByteDistributions,
  tokenBytes,
} from "./byteLogits.js";
import type { RequestFeatures } from "./complexity.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCandidate(value: unknown): TokenCandidate | null {
  if (!isRecord(value) || typeof value.token !== "string" || typeof value.logprob !== "number")
    return null;
  const bytes = Array.isArray(value.bytes) ? (value.bytes as number[]) : null;
  return { bytes: tokenBytes(value.token, bytes), logprob: value.logprob };
}

/** `choices[0].logprobs.content` de una respuesta OpenAI no-stream. */
export function readOpenAiLogprobContent(response: unknown): JsonRecord[] {
  const choice =
    isRecord(response) && Array.isArray(response.choices) ? response.choices[0] : undefined;
  const logprobs = isRecord(choice) && isRecord(choice.logprobs) ? choice.logprobs : undefined;
  return Array.isArray(logprobs?.content)
    ? (logprobs.content as JsonRecord[]).filter(isRecord)
    : [];
}

interface ByteDistillToken {
  token: string;
  positions: BytePosition[];
}

export function buildByteDistillTokens(
  content: readonly JsonRecord[],
  method: "end-of-token" | "marginalize-it",
): ByteDistillToken[] {
  const convert =
    method === "end-of-token" ? endOfTokenByteDistributions : marginalizeItByteDistributions;
  const result: ByteDistillToken[] = [];
  for (const entry of content) {
    const target = toCandidate(entry);
    if (!target || target.bytes.length === 0) continue;
    const candidates = (Array.isArray(entry.top_logprobs) ? entry.top_logprobs : [])
      .map(toCandidate)
      .filter((candidate): candidate is TokenCandidate => candidate !== null);
    result.push({
      token: String(entry.token),
      positions: convert(candidates, target.bytes, target.logprob),
    });
  }
  return result;
}

/** Preguntas tipadas de Laya para el router (formato `/v1/systemone`). */
export const LAYA_ROUTE_QUESTIONS = {
  route: {
    type: "choice",
    instructions: "Which executor should handle this coding-assistant request?",
    criteria: {
      local:
        "simple or short task a small local model can solve: quick questions, small edits, formatting, explanations, renames",
      swarm:
        "complex task needing a large model: multi-file changes, architecture, debugging, long reasoning, large context",
    },
  },
} as const;

export function layaRouteState(features: RequestFeatures): JsonRecord {
  return {
    body: features.userText,
    context: {
      user_bytes: features.userBytes,
      conversation_bytes: features.conversationBytes,
      messages: features.messageCount,
      tools: features.toolCount,
      code_blocks: features.codeBlocks,
      complex_hits: features.complexHits,
      simple_hits: features.simpleHits,
      has_image: features.hasImage,
    },
  };
}

const JUDGE_LABELS = ["A", "B"] as const;

/** Petición OpenAI al teacher: una letra, temperatura 0, con top-logprobs del primer token. */
export function buildRouteJudgeRequest(
  features: RequestFeatures,
  model: string,
  topLogprobs: number,
): JsonRecord {
  return {
    model,
    stream: false,
    temperature: 0,
    max_tokens: 1,
    logprobs: true,
    top_logprobs: topLogprobs,
    messages: [
      {
        role: "system",
        content:
          "You route requests for a coding assistant. Reply with exactly one letter: A if a small local model (1-3B parameters) can fully solve the request, B if it needs a large model.",
      },
      { role: "user", content: `Request:\n${features.userText}\n\nAnswer A or B.` },
    ],
  };
}

/** P(local) desde el primer token de la respuesta del juez; `null` si no hay logprobs. */
export function readRouteJudgeSoftLabel(
  response: unknown,
): { local: number; swarm: number } | null {
  const first = readOpenAiLogprobContent(response)[0];
  if (!first) return null;
  const candidates = [first, ...(Array.isArray(first.top_logprobs) ? first.top_logprobs : [])]
    .map(toCandidate)
    .filter((candidate): candidate is TokenCandidate => candidate !== null);
  if (candidates.length === 0) return null;
  // El token elegido también aparece en top_logprobs; se deduplica por bytes para no contarlo dos veces.
  const unique = new Map(candidates.map((candidate) => [candidate.bytes.join(","), candidate]));
  const distribution = firstByteLabelDistribution([...unique.values()], JUDGE_LABELS);
  return { local: distribution.A ?? 0.5, swarm: distribution.B ?? 0.5 };
}

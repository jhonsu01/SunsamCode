/**
 * RLCD (Reinforcement Learning from Contrastive Distillation): el teacher genera una respuesta
 * positiva y otra negativa a partir de prompts perturbados; el par (chosen, rejected) entrena el
 * SLM local con DPO sin etiquetas humanas (guía DeAI §4).
 */
import type { ApiFormat, ChatMessageText } from "./requestShape.js";

type JsonRecord = Record<string, unknown>;

function cloneBody(body: unknown): JsonRecord {
  return typeof body === "object" && body !== null ? (structuredClone(body) as JsonRecord) : {};
}

/** Copia no-stream de la petición con la instrucción de contraste añadida al system prompt. */
export function buildPerturbedRequest(
  body: unknown,
  format: ApiFormat,
  instruction: string,
  model: string,
): JsonRecord {
  const request = cloneBody(body);
  request.model = model;
  request.stream = false;
  delete request.stream_options;
  if (format === "anthropic") {
    const system = typeof request.system === "string" ? request.system : "";
    request.system = system ? `${system}\n\n${instruction}` : instruction;
    return request;
  }
  const messages = Array.isArray(request.messages) ? [...(request.messages as JsonRecord[])] : [];
  const first = messages[0];
  if (first && first.role === "system" && typeof first.content === "string") {
    messages[0] = { ...first, content: `${first.content}\n\n${instruction}` };
  } else {
    messages.unshift({ role: "system", content: instruction });
  }
  request.messages = messages;
  return request;
}

interface DpoRecord {
  prompt: Array<{ role: string; content: string }>;
  chosen: Array<{ role: "assistant"; content: string }>;
  rejected: Array<{ role: "assistant"; content: string }>;
  meta: Record<string, string | number | boolean>;
}

/** Formato conversacional aceptado por `trl.DPOTrainer` (prompt/chosen/rejected). */
export function buildDpoRecord(
  messages: readonly ChatMessageText[],
  chosen: string,
  rejected: string,
  meta: DpoRecord["meta"],
): DpoRecord | null {
  const trimmedChosen = chosen.trim();
  const trimmedRejected = rejected.trim();
  // Un par idéntico o vacío no aporta señal contrastiva y sólo añade ruido al DPO.
  if (!trimmedChosen || !trimmedRejected || trimmedChosen === trimmedRejected) return null;
  return {
    prompt: messages
      .filter((message) => message.text)
      .map((message) => ({ role: message.role, content: message.text })),
    chosen: [{ role: "assistant", content: trimmedChosen }],
    rejected: [{ role: "assistant", content: trimmedRejected }],
    meta,
  };
}

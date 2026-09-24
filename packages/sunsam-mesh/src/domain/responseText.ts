/**
 * Extracción incremental del texto generado en respuestas OpenAI/Anthropic (SSE o JSON), sin IO.
 * El gateway hace `tee` del stream y alimenta este acumulador para medir bytes/s y capturar la
 * respuesta que usan los trabajos RLCD.
 */
import type { ApiFormat } from "./requestShape.js";

interface ResponseTextAccumulator {
  push(chunk: string): void;
  /** Llamar al final: procesa la última línea sin salto o el cuerpo JSON no-stream. */
  finish(): void;
  readonly text: string;
  readonly usedTools: boolean;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

interface Extracted {
  text: string;
  usedTools: boolean;
}

function extractOpenAi(payload: unknown): Extracted {
  const choice =
    isRecord(payload) && Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  if (!isRecord(choice)) return { text: "", usedTools: false };
  const part = isRecord(choice.delta)
    ? choice.delta
    : isRecord(choice.message)
      ? choice.message
      : {};
  return {
    text: typeof part.content === "string" ? part.content : "",
    usedTools: Array.isArray(part.tool_calls) && part.tool_calls.length > 0,
  };
}

function extractAnthropic(payload: unknown): Extracted {
  if (!isRecord(payload)) return { text: "", usedTools: false };
  if (payload.type === "content_block_delta" && isRecord(payload.delta)) {
    return {
      text: typeof payload.delta.text === "string" ? payload.delta.text : "",
      usedTools: false,
    };
  }
  if (payload.type === "content_block_start" && isRecord(payload.content_block)) {
    return { text: "", usedTools: payload.content_block.type === "tool_use" };
  }
  if (Array.isArray(payload.content)) {
    let text = "";
    let usedTools = false;
    for (const block of payload.content) {
      if (!isRecord(block)) continue;
      if (block.type === "text" && typeof block.text === "string") text += block.text;
      if (block.type === "tool_use") usedTools = true;
    }
    return { text, usedTools };
  }
  return { text: "", usedTools: false };
}

export function createResponseTextAccumulator(format: ApiFormat): ResponseTextAccumulator {
  const extract = format === "openai" ? extractOpenAi : extractAnthropic;
  let buffer = "";
  let raw = "";
  let sawSse = false;
  let text = "";
  let usedTools = false;

  const apply = (payload: unknown) => {
    const extracted = extract(payload);
    text += extracted.text;
    usedTools ||= extracted.usedTools;
  };

  const consumeLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    sawSse = true;
    const data = line.slice(5).trim();
    if (data && data !== "[DONE]") apply(parseJson(data));
  };

  return {
    push(chunk) {
      raw += sawSse ? "" : chunk;
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        consumeLine(buffer.slice(0, newline).replace(/\r$/u, ""));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
      if (sawSse) raw = "";
    },
    finish() {
      if (buffer) consumeLine(buffer.replace(/\r$/u, ""));
      buffer = "";
      if (!sawSse && raw.trim()) apply(parseJson(raw));
      raw = "";
    },
    get text() {
      return text;
    },
    get usedTools() {
      return usedTools;
    },
  };
}

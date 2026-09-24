/**
 * Transporte HTTP hacia peers OpenAI/Anthropic compatibles (LM Studio, Ollama, vLLM, llama.cpp,
 * shim de Petals u otros nodos Sunsam Mesh).
 */
import type { PeerRequest, PeerResponse, PeerTransport } from "../app/ports.js";
import { bitsPerByte } from "../domain/bitsPerByte.js";
import type { PeerConfig } from "../domain/config.js";
import type { ApiFormat } from "../domain/requestShape.js";

export const HOPS_HEADER = "x-sunsam-hops";
const PASSTHROUGH_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "x-request-id",
  "request-id",
];
const encoder = new TextEncoder();

/** Acepta Base URL con o sin `/v1` final (LM Studio suele configurarse como `http://host:1234/v1`). */
function peerEndpoint(baseUrl: string, path: string): string {
  const trimmed = baseUrl.replace(/\/+$/u, "");
  return trimmed.endsWith("/v1") ? `${trimmed}${path}` : `${trimmed}/v1${path}`;
}

function authHeaders(peer: PeerConfig, format: ApiFormat): Record<string, string> {
  if (!peer.apiKey) return {};
  return format === "anthropic"
    ? { "x-api-key": peer.apiKey }
    : { authorization: `Bearer ${peer.apiKey}` };
}

function requestHeaders(request: PeerRequest): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(request.format === "anthropic" ? { "anthropic-version": "2023-06-01" } : {}),
    ...request.headers,
    ...authHeaders(request.peer, request.format),
    [HOPS_HEADER]: String(request.hops),
  };
}

function pathFor(format: ApiFormat): string {
  return format === "anthropic" ? "/messages" : "/chat/completions";
}

export class HttpPeerTransport implements PeerTransport {
  constructor(
    private readonly timeouts = { healthMs: 3000, jsonMs: 120_000, streamHeadersMs: 30_000 },
  ) {}

  async send(request: PeerRequest): Promise<PeerResponse> {
    // En streaming las cabeceras llegan enseguida: un peer colgado se aborta para pasar al
    // siguiente candidato. Sin streaming la respuesta llega al final, así que no se limita.
    const headersTimeout = new AbortController();
    const timer =
      request.body.stream === true
        ? setTimeout(
            () => headersTimeout.abort(new Error("timeout esperando cabeceras")),
            this.timeouts.streamHeadersMs,
          )
        : undefined;
    const signal = request.signal
      ? AbortSignal.any([request.signal, headersTimeout.signal])
      : headersTimeout.signal;
    let response: Response;
    try {
      response = await fetch(peerEndpoint(request.peer.baseUrl, pathFor(request.format)), {
        method: "POST",
        headers: requestHeaders(request),
        body: JSON.stringify(request.body),
        signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const headers: Record<string, string> = {};
    for (const name of PASSTHROUGH_RESPONSE_HEADERS) {
      const value = response.headers.get(name);
      if (value) headers[name] = value;
    }
    return { status: response.status, headers, body: response.body };
  }

  async sendJson(request: PeerRequest): Promise<unknown> {
    const response = await fetch(peerEndpoint(request.peer.baseUrl, pathFor(request.format)), {
      method: "POST",
      headers: requestHeaders(request),
      body: JSON.stringify({ ...request.body, stream: false }),
      signal: request.signal ?? AbortSignal.timeout(this.timeouts.jsonMs),
    });
    const text = await response.text();
    if (!response.ok)
      throw new Error(`peer ${request.peer.id} HTTP ${response.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text) as unknown;
  }

  async probeHealth(peer: PeerConfig): Promise<boolean> {
    const format = peer.apiFormats[0] ?? "openai";
    try {
      const response = await fetch(peerEndpoint(peer.baseUrl, "/models"), {
        headers: authHeaders(peer, format),
        signal: AbortSignal.timeout(this.timeouts.healthMs),
      });
      await response.body?.cancel();
      // 401/404 indican que el servidor responde aunque no exponga /models (algunos shims).
      return response.status < 500;
    } catch {
      return false;
    }
  }

  async probeBitsPerByte(peer: PeerConfig, text: string): Promise<number | null> {
    if (!peer.apiFormats.includes("openai")) return null;
    const response = await fetch(peerEndpoint(peer.baseUrl, "/completions"), {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders(peer, "openai") },
      body: JSON.stringify({
        model: peer.models[0],
        prompt: text,
        max_tokens: 1,
        echo: true,
        logprobs: 1,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(this.timeouts.jsonMs),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ logprobs?: { tokens?: string[]; token_logprobs?: Array<number | null> } }>;
    };
    const logprobs = payload.choices?.[0]?.logprobs;
    const tokens = logprobs?.tokens ?? [];
    const values = logprobs?.token_logprobs ?? [];
    // Sólo se puntúan los tokens del prompt (el primero no tiene logprob; el último es el generado).
    const promptTokens = Math.max(0, tokens.length - 1);
    const scored = tokens.slice(0, promptTokens).flatMap((token, index) => {
      const logprob = values[index];
      return typeof logprob === "number"
        ? [{ logprob, byteLength: encoder.encode(token).length }]
        : [];
    });
    return bitsPerByte(scored);
  }
}

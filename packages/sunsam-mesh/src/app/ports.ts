/**
 * Puertos que la capa app necesita; los adapters (HTTP, UDP, ficheros) los implementan.
 */
import type { PeerConfig } from "../domain/config.js";
import type { RequestFeatures } from "../domain/complexity.js";
import type { ApiFormat } from "../domain/requestShape.js";

export interface PeerRequest {
  peer: PeerConfig;
  format: ApiFormat;
  body: Record<string, unknown>;
  /** Hops ya recorridos por la petición (anti-bucle entre nodos mesh). */
  hops: number;
  /** Cabeceras del cliente que deben llegar al peer (p. ej. `anthropic-version`). */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface PeerResponse {
  status: number;
  headers: Record<string, string>;
  body: ReadableStream<Uint8Array> | null;
}

export interface PeerTransport {
  send(request: PeerRequest): Promise<PeerResponse>;
  /** JSON no-stream (trabajos de feedback). Lanza si el estado no es 2xx. */
  sendJson(request: PeerRequest): Promise<unknown>;
  probeHealth(peer: PeerConfig): Promise<boolean>;
  /** BPB sobre un texto de calibración; `null` si el peer no soporta echo+logprobs. */
  probeBitsPerByte(peer: PeerConfig, text: string): Promise<number | null>;
}

export interface ClassifierResult {
  pLocal: number;
  classifier: "heuristic" | "laya" | "heuristic-fallback";
}

export interface Classifier {
  classify(features: RequestFeatures): Promise<ClassifierResult>;
}

export type DatasetName =
  | "decisions"
  | "rlcd-pairs"
  | "byte-distill"
  | "laya-soft-labels"
  | "feedback";

export interface DatasetSink {
  append(dataset: DatasetName, record: unknown): Promise<void>;
}

export interface MeshLogger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export interface Clock {
  now(): number;
}

export interface Random {
  next(): number;
}

/**
 * Configuración de Sunsam Mesh: tipos, valores por defecto y validación pura de un JSON arbitrario.
 */
import { DEFAULT_HEURISTIC_WEIGHTS, type HeuristicWeights } from "./complexity.js";
import type { ApiFormat } from "./requestShape.js";

export type Tier = "local" | "swarm";

export interface PeerConfig {
  id: string;
  baseUrl: string;
  /** Formato de API que acepta el peer; los nodos mesh aceptan ambos. */
  apiFormats: ApiFormat[];
  apiKey?: string;
  tier: Tier;
  models: string[];
  /** `mesh` = otro nodo Sunsam Mesh (se aplica anti-bucle por hops). */
  kind: "direct" | "mesh";
  /** Sondear BPB con `/v1/completions` + echo + logprobs (vLLM, llama.cpp). */
  bpbProbe: boolean;
  maxInflight: number;
}

export interface CostWeights {
  quality: number;
  latency: number;
  throughput: number;
  load: number;
}

export interface FeedbackSampling {
  enabled: boolean;
  sampleRate: number;
}

export interface MeshConfig {
  server: { host: string; port: number; apiKey?: string };
  router: {
    classifier: "heuristic" | "laya";
    threshold: number;
    stickyTtlMs: number;
    heuristicBias: number;
    heuristicWeights: HeuristicWeights;
    laya: { url: string; apiKey?: string; timeoutMs: number };
  };
  routing: { defaultBpb: number; weights: Record<Tier, CostWeights> };
  peers: PeerConfig[];
  mesh: { nodeId: string; maxHops: number };
  discovery: {
    enabled: boolean;
    port: number;
    intervalMs: number;
    sharedSecret?: string;
    advertiseUrl?: string;
  };
  feedback: {
    dataDir: string;
    /** Peer que actúa como teacher; por defecto el primer peer `swarm`. */
    teacherPeer?: string;
    rlcd: FeedbackSampling & {
      reuseServedAsChosen: boolean;
      positiveInstruction: string;
      negativeInstruction: string;
    };
    byteDistill: FeedbackSampling & {
      topLogprobs: number;
      method: "end-of-token" | "marginalize-it";
    };
    layaSoftLabels: FeedbackSampling;
  };
  health: { intervalMs: number };
}

export const DEFAULT_MESH_CONFIG: MeshConfig = {
  server: { host: "127.0.0.1", port: 4141 },
  router: {
    classifier: "heuristic",
    threshold: 0.75,
    stickyTtlMs: 30 * 60_000,
    heuristicBias: 0,
    heuristicWeights: DEFAULT_HEURISTIC_WEIGHTS,
    laya: { url: "http://127.0.0.1:8000", timeoutMs: 1500 },
  },
  routing: {
    defaultBpb: 1.0,
    weights: {
      local: { quality: 0.5, latency: 1.5, throughput: 1.0, load: 0.5 },
      swarm: { quality: 3.0, latency: 0.5, throughput: 0.5, load: 0.5 },
    },
  },
  peers: [],
  mesh: { nodeId: "sunsam-node", maxHops: 1 },
  discovery: { enabled: false, port: 41414, intervalMs: 5000 },
  feedback: {
    dataDir: "~/.sunsam/mesh-data",
    rlcd: {
      enabled: false,
      sampleRate: 0.1,
      reuseServedAsChosen: true,
      positiveInstruction: "Instrucciones: responde de forma detallada, precisa y clara.",
      negativeInstruction: "Instrucciones: responde de forma breve, vaga e incompleta.",
    },
    byteDistill: { enabled: false, sampleRate: 0.05, topLogprobs: 20, method: "end-of-token" },
    layaSoftLabels: { enabled: false, sampleRate: 0.2 },
  },
  health: { intervalMs: 15_000 },
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown, path: string): JsonRecord {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`mesh config: ${path} debe ser un objeto`);
  }
  return value as JsonRecord;
}

function num(
  value: unknown,
  fallback: number,
  path: string,
  min = -Infinity,
  max = Infinity,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`mesh config: ${path} debe ser un número en [${min}, ${max}]`);
  }
  return value;
}

function str(value: unknown, fallback: string, path: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`mesh config: ${path} debe ser un texto no vacío`);
  }
  return value.trim();
}

function optStr(value: unknown, path: string): string | undefined {
  return value === undefined || value === "" ? undefined : str(value, "", path);
}

function bool(value: unknown, fallback: boolean, path: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(`mesh config: ${path} debe ser booleano`);
  return value;
}

function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
  path: string,
): T {
  if (value === undefined) return fallback;
  if (!options.includes(value as T)) {
    throw new Error(`mesh config: ${path} debe ser uno de ${options.join(", ")}`);
  }
  return value as T;
}

function parseWeights(value: unknown, fallback: CostWeights, path: string): CostWeights {
  const input = record(value, path);
  return {
    quality: num(input.quality, fallback.quality, `${path}.quality`, 0),
    latency: num(input.latency, fallback.latency, `${path}.latency`, 0),
    throughput: num(input.throughput, fallback.throughput, `${path}.throughput`, 0),
    load: num(input.load, fallback.load, `${path}.load`, 0),
  };
}

function parseHeuristicWeights(value: unknown): HeuristicWeights {
  const input = record(value, "router.heuristicWeights");
  const weights = { ...DEFAULT_HEURISTIC_WEIGHTS };
  for (const key of Object.keys(weights) as Array<keyof HeuristicWeights>) {
    weights[key] = num(input[key], weights[key], `router.heuristicWeights.${key}`, -100, 100);
  }
  return weights;
}

function parsePeerConfig(value: unknown, index: number): PeerConfig {
  const path = `peers[${index}]`;
  const input = record(value, path);
  const kind = oneOf(input.kind, ["direct", "mesh"] as const, "direct", `${path}.kind`);
  const formats = input.apiFormats ?? (input.apiFormat ? [input.apiFormat] : undefined);
  const apiFormats = Array.isArray(formats)
    ? formats.map((format, formatIndex) =>
        oneOf(
          format,
          ["openai", "anthropic"] as const,
          "openai",
          `${path}.apiFormats[${formatIndex}]`,
        ),
      )
    : kind === "mesh"
      ? (["openai", "anthropic"] as ApiFormat[])
      : (["openai"] as ApiFormat[]);
  const models = Array.isArray(input.models)
    ? input.models.map((model, i) => str(model, "", `${path}.models[${i}]`))
    : [];
  const baseUrl = str(input.baseUrl, "", `${path}.baseUrl`).replace(/\/+$/u, "");
  if (!/^https?:\/\//u.test(baseUrl))
    throw new Error(`mesh config: ${path}.baseUrl debe ser http(s)`);
  return {
    id: str(input.id, `peer-${index + 1}`, `${path}.id`),
    baseUrl,
    apiFormats,
    apiKey: optStr(input.apiKey, `${path}.apiKey`),
    tier: oneOf(input.tier, ["local", "swarm"] as const, "local", `${path}.tier`),
    models,
    kind,
    bpbProbe: bool(input.bpbProbe, false, `${path}.bpbProbe`),
    maxInflight: num(input.maxInflight, 4, `${path}.maxInflight`, 1, 1024),
  };
}

function sampling<T extends FeedbackSampling>(
  value: JsonRecord,
  fallback: T,
  path: string,
): FeedbackSampling {
  return {
    enabled: bool(value.enabled, fallback.enabled, `${path}.enabled`),
    sampleRate: num(value.sampleRate, fallback.sampleRate, `${path}.sampleRate`, 0, 1),
  };
}

export function parseMeshConfig(value: unknown): MeshConfig {
  const d = DEFAULT_MESH_CONFIG;
  const input = record(value, "config");
  const server = record(input.server, "server");
  const router = record(input.router, "router");
  const laya = record(router.laya, "router.laya");
  const routing = record(input.routing, "routing");
  const weights = record(routing.weights, "routing.weights");
  const mesh = record(input.mesh, "mesh");
  const discovery = record(input.discovery, "discovery");
  const feedback = record(input.feedback, "feedback");
  const rlcd = record(feedback.rlcd, "feedback.rlcd");
  const byteDistill = record(feedback.byteDistill, "feedback.byteDistill");
  const layaSoftLabels = record(feedback.layaSoftLabels, "feedback.layaSoftLabels");
  const peersInput = input.peers === undefined ? [] : input.peers;
  if (!Array.isArray(peersInput)) throw new Error("mesh config: peers debe ser una lista");
  const peers = peersInput.map(parsePeerConfig);
  const duplicated = peers.find(
    (peer, index) => peers.findIndex((other) => other.id === peer.id) !== index,
  );
  if (duplicated) throw new Error(`mesh config: peer duplicado "${duplicated.id}"`);

  return {
    server: {
      host: str(server.host, d.server.host, "server.host"),
      port: num(server.port, d.server.port, "server.port", 0, 65_535),
      apiKey: optStr(server.apiKey, "server.apiKey"),
    },
    router: {
      classifier: oneOf(
        router.classifier,
        ["heuristic", "laya"] as const,
        d.router.classifier,
        "router.classifier",
      ),
      threshold: num(router.threshold, d.router.threshold, "router.threshold", 0, 1),
      stickyTtlMs: num(router.stickyTtlMs, d.router.stickyTtlMs, "router.stickyTtlMs", 0),
      heuristicBias: num(
        router.heuristicBias,
        d.router.heuristicBias,
        "router.heuristicBias",
        -10,
        10,
      ),
      heuristicWeights: parseHeuristicWeights(router.heuristicWeights),
      laya: {
        url: str(laya.url, d.router.laya.url, "router.laya.url").replace(/\/+$/u, ""),
        apiKey: optStr(laya.apiKey, "router.laya.apiKey"),
        timeoutMs: num(
          laya.timeoutMs,
          d.router.laya.timeoutMs,
          "router.laya.timeoutMs",
          50,
          60_000,
        ),
      },
    },
    routing: {
      defaultBpb: num(routing.defaultBpb, d.routing.defaultBpb, "routing.defaultBpb", 0),
      weights: {
        local: parseWeights(weights.local, d.routing.weights.local, "routing.weights.local"),
        swarm: parseWeights(weights.swarm, d.routing.weights.swarm, "routing.weights.swarm"),
      },
    },
    peers,
    mesh: {
      nodeId: str(mesh.nodeId, d.mesh.nodeId, "mesh.nodeId"),
      maxHops: num(mesh.maxHops, d.mesh.maxHops, "mesh.maxHops", 0, 8),
    },
    discovery: {
      enabled: bool(discovery.enabled, d.discovery.enabled, "discovery.enabled"),
      port: num(discovery.port, d.discovery.port, "discovery.port", 1, 65_535),
      intervalMs: num(discovery.intervalMs, d.discovery.intervalMs, "discovery.intervalMs", 500),
      sharedSecret: optStr(discovery.sharedSecret, "discovery.sharedSecret"),
      advertiseUrl: optStr(discovery.advertiseUrl, "discovery.advertiseUrl"),
    },
    feedback: {
      dataDir: str(feedback.dataDir, d.feedback.dataDir, "feedback.dataDir"),
      teacherPeer: optStr(feedback.teacherPeer, "feedback.teacherPeer"),
      rlcd: {
        ...sampling(rlcd, d.feedback.rlcd, "feedback.rlcd"),
        reuseServedAsChosen: bool(
          rlcd.reuseServedAsChosen,
          d.feedback.rlcd.reuseServedAsChosen,
          "feedback.rlcd.reuseServedAsChosen",
        ),
        positiveInstruction: str(
          rlcd.positiveInstruction,
          d.feedback.rlcd.positiveInstruction,
          "feedback.rlcd.positiveInstruction",
        ),
        negativeInstruction: str(
          rlcd.negativeInstruction,
          d.feedback.rlcd.negativeInstruction,
          "feedback.rlcd.negativeInstruction",
        ),
      },
      byteDistill: {
        ...sampling(byteDistill, d.feedback.byteDistill, "feedback.byteDistill"),
        topLogprobs: num(
          byteDistill.topLogprobs,
          d.feedback.byteDistill.topLogprobs,
          "feedback.byteDistill.topLogprobs",
          1,
          20,
        ),
        method: oneOf(
          byteDistill.method,
          ["end-of-token", "marginalize-it"] as const,
          d.feedback.byteDistill.method,
          "feedback.byteDistill.method",
        ),
      },
      layaSoftLabels: sampling(
        layaSoftLabels,
        d.feedback.layaSoftLabels,
        "feedback.layaSoftLabels",
      ),
    },
    health: {
      intervalMs: num(
        record(input.health, "health").intervalMs,
        d.health.intervalMs,
        "health.intervalMs",
        1000,
      ),
    },
  };
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/** Exponer el gateway fuera de loopback sin apiKey dejaría la red abierta a cualquiera. */
export function assertSafeServerBinding(config: MeshConfig): void {
  if (!LOOPBACK_HOSTS.has(config.server.host) && !config.server.apiKey) {
    throw new Error(
      `mesh config: server.apiKey es obligatorio cuando server.host (${config.server.host}) no es loopback`,
    );
  }
  if (config.discovery.enabled && !config.discovery.sharedSecret) {
    throw new Error("mesh config: discovery.sharedSecret es obligatorio con discovery.enabled");
  }
}

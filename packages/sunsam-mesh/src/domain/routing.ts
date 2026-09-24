/**
 * Decisión de tier y ranking de peers (puro). El coste combina calidad (BPB, independiente del
 * tokenizador), latencia (TTFT), throughput en bytes/s y carga actual.
 */
import type { CostWeights, PeerConfig, Tier } from "./config.js";
import type { ApiFormat } from "./requestShape.js";

export const VIRTUAL_MODELS = {
  auto: "sunsam-auto",
  local: "sunsam-local",
  swarm: "sunsam-swarm",
} as const;

export type RouteTarget =
  | { kind: "auto" }
  | { kind: "tier"; tier: Tier }
  | { kind: "direct"; peerId: string; model: string };

/** `sunsam-auto|local|swarm` o `<peerId>/<modelo>`; cualquier otro nombre se trata como auto. */
export function resolveVirtualModel(model: string, peerIds: ReadonlySet<string>): RouteTarget {
  if (model === VIRTUAL_MODELS.local) return { kind: "tier", tier: "local" };
  if (model === VIRTUAL_MODELS.swarm) return { kind: "tier", tier: "swarm" };
  const slash = model.indexOf("/");
  if (slash > 0) {
    const peerId = model.slice(0, slash);
    if (peerIds.has(peerId)) return { kind: "direct", peerId, model: model.slice(slash + 1) };
  }
  return { kind: "auto" };
}

export function decideTier(localProbability: number, threshold: number): Tier {
  return localProbability >= threshold ? "local" : "swarm";
}

function otherTier(tier: Tier): Tier {
  return tier === "local" ? "swarm" : "local";
}

/** Vista de sólo lectura del estado que `PeerRegistry` mantiene por peer. */
export interface PeerRuntimeView {
  config: PeerConfig;
  healthy: boolean;
  inflight: number;
  ttftMs?: number;
  bytesPerSecond?: number;
  bpb?: number;
}

function peerCost(peer: PeerRuntimeView, weights: CostWeights, defaultBpb: number): number {
  const quality = peer.bpb ?? defaultBpb;
  const latencySeconds = (peer.ttftMs ?? 1000) / 1000;
  // 1000 B/s ≈ 220 tokens/s de referencia: el término vale ~1 para peers lentos y ~0 para rápidos.
  const throughputPenalty = 1000 / ((peer.bytesPerSecond ?? 500) + 1);
  const load = peer.inflight / peer.config.maxInflight;
  return (
    weights.quality * quality +
    weights.latency * latencySeconds +
    weights.throughput * throughputPenalty +
    weights.load * load
  );
}

interface RankOptions {
  tier: Tier;
  format: ApiFormat;
  weights: Record<Tier, CostWeights>;
  defaultBpb: number;
  /** Si es false, se excluyen nodos mesh (anti-bucle por hops). */
  allowMesh: boolean;
}

/** Candidatos del tier pedido (por coste) seguidos de los del otro tier como fallback. */
export function rankPeers(
  peers: readonly PeerRuntimeView[],
  options: RankOptions,
): PeerRuntimeView[] {
  const eligible = peers.filter(
    (peer) =>
      peer.healthy &&
      peer.config.apiFormats.includes(options.format) &&
      peer.inflight < peer.config.maxInflight &&
      (options.allowMesh || peer.config.kind !== "mesh"),
  );
  const byTier = (tier: Tier) =>
    eligible
      .filter((peer) => peer.config.tier === tier)
      .map((peer) => ({ peer, cost: peerCost(peer, options.weights[tier], options.defaultBpb) }))
      .sort(
        (left, right) =>
          left.cost - right.cost || left.peer.config.id.localeCompare(right.peer.config.id),
      )
      .map(({ peer }) => peer);
  return [...byTier(options.tier), ...byTier(otherTier(options.tier))];
}

/** Modelo a pedir al peer: el concreto en rutas directas; si no, el primero declarado. */
export function modelForPeer(
  peer: PeerConfig,
  requested: RouteTarget,
  originalModel: string,
): string {
  if (requested.kind === "direct") return requested.model;
  return peer.models[0] ?? originalModel;
}

/**
 * Orquesta una petición: modelo virtual → tier (sticky por conversación) → ranking de peers →
 * forward con fallback antes del primer byte → observación del stream → feedback en segundo plano.
 */
import { bytesPerSecond } from "../domain/bitsPerByte.js";
import {
  calibrationReport,
  suggestThreshold,
  type LabeledDecision,
} from "../domain/calibration.js";
import type { MeshConfig, Tier } from "../domain/config.js";
import { extractRequestFeatures, type RequestFeatures } from "../domain/complexity.js";
import {
  type ApiFormat,
  conversationSeed,
  fnv1a,
  isToolContinuation,
  readModel,
  withModel,
} from "../domain/requestShape.js";
import { createResponseTextAccumulator } from "../domain/responseText.js";
import {
  VIRTUAL_MODELS,
  decideTier,
  modelForPeer,
  rankPeers,
  resolveVirtualModel,
  type RouteTarget,
} from "../domain/routing.js";
import type { FeedbackJobs } from "./feedbackJobs.js";
import type { PeerRegistry } from "./peerRegistry.js";
import type {
  Classifier,
  ClassifierResult,
  Clock,
  DatasetSink,
  MeshLogger,
  PeerTransport,
} from "./ports.js";
import { observeStream } from "./streamObserver.js";

interface RouteRequest {
  format: ApiFormat;
  body: unknown;
  hops: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface DecisionRecord {
  id: string;
  ts: number;
  conversationKey: string;
  requestedModel: string;
  tier: Tier;
  pLocal: number | null;
  classifier: ClassifierResult["classifier"] | "forced" | "sticky";
  peerId?: string;
  model?: string;
  attempts: Array<{ peerId: string; error: string }>;
  status?: number;
  ttftMs?: number;
  textBytes?: number;
  durationMs?: number;
  features: Omit<RequestFeatures, "userText">;
}

interface RoutedResponse {
  status: number;
  headers: Record<string, string>;
  body: ReadableStream<Uint8Array> | null;
  decision: DecisionRecord;
}

interface StickyEntry {
  tier: Tier;
  pLocal: number | null;
  expiresAt: number;
}

interface MeshRouterDeps {
  config: MeshConfig;
  registry: PeerRegistry;
  transport: PeerTransport;
  classifier: Classifier;
  jobs: FeedbackJobs | null;
  sink: DatasetSink;
  logger: MeshLogger;
  clock: Clock;
  newId: () => string;
}

const MAX_STICKY = 5000;
const MAX_RECENT = 2000;
const RETRYABLE_STATUS = (status: number) => status >= 500 || status === 429;

export class MeshRouter {
  private readonly sticky = new Map<string, StickyEntry>();
  private readonly recent = new Map<string, DecisionRecord>();
  private readonly labeled: LabeledDecision[] = [];

  constructor(private readonly deps: MeshRouterDeps) {}

  listModels(): string[] {
    const direct = this.deps.registry
      .views()
      .flatMap((peer) => peer.config.models.map((model) => `${peer.config.id}/${model}`));
    return [VIRTUAL_MODELS.auto, VIRTUAL_MODELS.local, VIRTUAL_MODELS.swarm, ...direct];
  }

  async route(request: RouteRequest): Promise<RoutedResponse> {
    const { config, registry, transport, clock, logger } = this.deps;
    const startedAt = clock.now();
    const requestedModel = readModel(request.body);
    const target = resolveVirtualModel(requestedModel, registry.ids());
    const features = extractRequestFeatures(request.body, request.format);
    const conversationKey = fnv1a(
      `${requestedModel}\u0000${conversationSeed(request.body, request.format)}`,
    );
    const { userText: _omitted, ...loggedFeatures } = features;
    const decision: DecisionRecord = {
      id: this.deps.newId(),
      ts: startedAt,
      conversationKey,
      requestedModel,
      ...(await this.resolveTier(target, features, conversationKey, request)),
      attempts: [],
      features: loggedFeatures,
    };

    const candidates =
      target.kind === "direct"
        ? registry.views().filter((peer) => peer.config.id === target.peerId)
        : rankPeers(registry.views(), {
            tier: decision.tier,
            format: request.format,
            weights: config.routing.weights,
            defaultBpb: config.routing.defaultBpb,
            allowMesh: request.hops < config.mesh.maxHops,
          });
    if (candidates.length === 0) {
      return this.finishWithError(
        decision,
        503,
        "sunsam_no_peer",
        "No hay peers sanos para esta petición",
      );
    }

    for (const candidate of candidates) {
      const peer = candidate.config;
      const model = modelForPeer(peer, target, requestedModel);
      registry.begin(peer.id);
      const sentAt = clock.now();
      try {
        const response = await transport.send({
          peer,
          format: request.format,
          body: withModel(request.body, model),
          hops: request.hops + 1,
          headers: request.headers,
          signal: request.signal,
        });
        if (RETRYABLE_STATUS(response.status)) {
          await response.body?.cancel().catch(() => undefined);
          throw new Error(`HTTP ${response.status}`);
        }
        decision.peerId = peer.id;
        decision.model = model;
        decision.tier = peer.tier;
        decision.status = response.status;
        if (!response.body) {
          registry.end(peer.id);
          this.record(decision);
          return { status: response.status, headers: response.headers, body: null, decision };
        }
        const body = this.observe(response.body, request, decision, sentAt, features);
        return { status: response.status, headers: response.headers, body, decision };
      } catch (error) {
        registry.end(peer.id);
        const message = error instanceof Error ? error.message : String(error);
        if (request.signal?.aborted) throw error;
        registry.recordFailure(peer.id, message);
        decision.attempts.push({ peerId: peer.id, error: message });
        logger.warn("peer falló antes del primer byte; probando siguiente", {
          peer: peer.id,
          error: message,
        });
      }
    }
    return this.finishWithError(
      decision,
      502,
      "sunsam_all_peers_failed",
      "Todos los peers fallaron",
    );
  }

  /** Etiqueta explícita (p. ej. desde la app o un evaluador) para calibrar el router. */
  async recordFeedback(decisionId: string, localSufficient: boolean): Promise<boolean> {
    const decision = this.recent.get(decisionId);
    if (!decision || decision.pLocal === null) return false;
    this.labeled.push({ pLocal: decision.pLocal, localSufficient });
    if (this.labeled.length > MAX_RECENT) this.labeled.shift();
    await this.deps.sink.append("feedback", {
      decisionId,
      localSufficient,
      pLocal: decision.pLocal,
      tier: decision.tier,
      ts: this.deps.clock.now(),
    });
    return true;
  }

  calibration() {
    return {
      ...calibrationReport(this.labeled),
      threshold: this.deps.config.router.threshold,
      suggestedThreshold: suggestThreshold(this.labeled),
    };
  }

  private async resolveTier(
    target: RouteTarget,
    features: RequestFeatures,
    conversationKey: string,
    request: RouteRequest,
  ): Promise<Pick<DecisionRecord, "tier" | "pLocal" | "classifier">> {
    if (target.kind === "tier") return { tier: target.tier, pLocal: null, classifier: "forced" };
    if (target.kind === "direct") {
      return {
        tier: this.deps.registry.get(target.peerId)?.tier ?? "local",
        pLocal: null,
        classifier: "forced",
      };
    }
    const now = this.deps.clock.now();
    const cached = this.sticky.get(conversationKey);
    if (cached && cached.expiresAt > now) {
      cached.expiresAt = now + this.deps.config.router.stickyTtlMs;
      return { tier: cached.tier, pLocal: cached.pLocal, classifier: "sticky" };
    }
    // Una continuación de herramienta sin entrada sticky (p. ej. tras reiniciar el gateway) se
    // clasifica igual; a partir de aquí queda fijada para el resto del bucle agente.
    if (isToolContinuation(request.body, request.format)) {
      this.deps.logger.debug("continuación de herramienta sin sticky; se clasifica de nuevo", {
        conversationKey,
      });
    }
    const result = await this.deps.classifier.classify(features);
    const tier = decideTier(result.pLocal, this.deps.config.router.threshold);
    if (this.sticky.size >= MAX_STICKY) this.sticky.delete(this.sticky.keys().next().value!);
    this.sticky.set(conversationKey, {
      tier,
      pLocal: result.pLocal,
      expiresAt: now + this.deps.config.router.stickyTtlMs,
    });
    return { tier, pLocal: result.pLocal, classifier: result.classifier };
  }

  private observe(
    upstream: ReadableStream<Uint8Array>,
    request: RouteRequest,
    decision: DecisionRecord,
    sentAt: number,
    features: RequestFeatures,
  ): ReadableStream<Uint8Array> {
    const { registry, clock, jobs } = this.deps;
    const peerId = decision.peerId!;
    const accumulator = createResponseTextAccumulator(request.format);
    return observeStream(upstream, clock, {
      onChunk: (text) => accumulator.push(text),
      onEnd: ({ firstChunkAt, endedAt, failed, cancelled }) => {
        registry.end(peerId);
        accumulator.finish();
        const textBytes = new TextEncoder().encode(accumulator.text).length;
        decision.ttftMs = firstChunkAt === undefined ? undefined : firstChunkAt - sentAt;
        decision.textBytes = textBytes;
        decision.durationMs = endedAt - decision.ts;
        if (failed) {
          registry.recordFailure(peerId, "stream interrumpido");
        } else if (!cancelled) {
          registry.recordSuccess(peerId, {
            ttftMs: decision.ttftMs,
            bytesPerSecond:
              firstChunkAt === undefined ? null : bytesPerSecond(textBytes, endedAt - firstChunkAt),
          });
          jobs?.enqueue({
            format: request.format,
            body: request.body,
            features,
            decision,
            responseText: accumulator.text,
            usedTools: accumulator.usedTools,
          });
        }
        this.record(decision);
      },
    });
  }

  private record(decision: DecisionRecord): void {
    this.recent.set(decision.id, decision);
    if (this.recent.size > MAX_RECENT) this.recent.delete(this.recent.keys().next().value!);
    void this.deps.sink.append("decisions", decision).catch((error: unknown) => {
      this.deps.logger.warn("no se pudo escribir la decisión", { error: String(error) });
    });
  }

  private finishWithError(
    decision: DecisionRecord,
    status: number,
    type: string,
    message: string,
  ): RoutedResponse {
    decision.status = status;
    this.record(decision);
    const payload = JSON.stringify({
      error: { type, message, attempts: decision.attempts, decisionId: decision.id },
    });
    return {
      status,
      headers: { "content-type": "application/json" },
      body: new Response(payload).body,
      decision,
    };
  }
}

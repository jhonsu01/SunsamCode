/**
 * Bucle de auto-mejora (guía DeAI §4 + paper de bytes), siempre fuera del camino crítico:
 * - RLCD: pares (chosen, rejected) del teacher para DPO del SLM local.
 * - Byte distill: distribuciones End-Of-Token / Marginalize-It del teacher.
 * - Laya soft labels: P(local) del teacher por marginal del primer byte, para destilar el router.
 * Cola serie y acotada: si se llena, se descartan trabajos (nunca bloquea respuestas).
 */
import type { MeshConfig, PeerConfig } from "../domain/config.js";
import type { RequestFeatures } from "../domain/complexity.js";
import { type ApiFormat, readMessages, readToolCount } from "../domain/requestShape.js";
import { createResponseTextAccumulator } from "../domain/responseText.js";
import { buildDpoRecord, buildPerturbedRequest } from "../domain/rlcd.js";
import {
  LAYA_ROUTE_QUESTIONS,
  buildByteDistillTokens,
  buildRouteJudgeRequest,
  layaRouteState,
  readOpenAiLogprobContent,
  readRouteJudgeSoftLabel,
} from "../domain/teacherSignals.js";
import type { PeerRegistry } from "./peerRegistry.js";
import type { DatasetSink, MeshLogger, PeerTransport, Random } from "./ports.js";

interface FeedbackContext {
  format: ApiFormat;
  body: unknown;
  features: RequestFeatures;
  decision: {
    id: string;
    tier: string;
    pLocal: number | null;
    classifier: string;
    peerId?: string;
  };
  responseText: string;
  usedTools: boolean;
}

interface FeedbackJobsDeps {
  config: MeshConfig;
  registry: PeerRegistry;
  transport: PeerTransport;
  sink: DatasetSink;
  logger: MeshLogger;
  random: Random;
  maxQueue?: number;
}

type Job = () => Promise<void>;

export class FeedbackJobs {
  private readonly queue: Job[] = [];
  private running: Promise<void> | null = null;

  constructor(private readonly deps: FeedbackJobsDeps) {}

  enqueue(context: FeedbackContext): void {
    const { feedback } = this.deps.config;
    const plainText = readToolCount(context.body) === 0 && !context.usedTools;
    if (
      feedback.rlcd.enabled &&
      plainText &&
      context.responseText.trim() &&
      context.decision.tier === "swarm" &&
      this.sample(feedback.rlcd.sampleRate)
    ) {
      this.push(() => this.rlcdPair(context));
    }
    if (feedback.byteDistill.enabled && plainText && this.sample(feedback.byteDistill.sampleRate)) {
      this.push(() => this.byteDistill(context));
    }
    if (
      feedback.layaSoftLabels.enabled &&
      context.features.userText &&
      this.sample(feedback.layaSoftLabels.sampleRate)
    ) {
      this.push(() => this.layaSoftLabel(context));
    }
  }

  pending(): number {
    return this.queue.length + (this.running ? 1 : 0);
  }

  /** Espera a que la cola se vacíe (tests y apagado ordenado). */
  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  private sample(rate: number): boolean {
    return rate > 0 && this.deps.random.next() < rate;
  }

  private push(job: Job): void {
    if (this.queue.length >= (this.deps.maxQueue ?? 32)) {
      this.deps.logger.debug("cola de feedback llena; trabajo descartado");
      return;
    }
    this.queue.push(job);
    this.running ??= this.drain();
  }

  private async drain(): Promise<void> {
    try {
      for (let job = this.queue.shift(); job; job = this.queue.shift()) {
        try {
          await job();
        } catch (error) {
          this.deps.logger.warn("trabajo de feedback falló", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      this.running = null;
    }
  }

  private teacher(format: ApiFormat): PeerConfig | null {
    const views = this.deps.registry.views();
    const preferred = this.deps.config.feedback.teacherPeer;
    const match = views.find(
      (peer) =>
        (preferred ? peer.config.id === preferred : peer.config.tier === "swarm" && peer.healthy) &&
        peer.config.apiFormats.includes(format),
    );
    return match?.config ?? null;
  }

  private async generateText(
    peer: PeerConfig,
    format: ApiFormat,
    body: Record<string, unknown>,
  ): Promise<string> {
    const response = await this.deps.transport.sendJson({ peer, format, body, hops: 1 });
    const accumulator = createResponseTextAccumulator(format);
    accumulator.push(JSON.stringify(response));
    accumulator.finish();
    return accumulator.text;
  }

  private async rlcdPair(context: FeedbackContext): Promise<void> {
    const { rlcd } = this.deps.config.feedback;
    const teacher = this.teacher(context.format);
    if (!teacher) return;
    const model = teacher.models[0] ?? String((context.body as { model?: unknown }).model ?? "");
    const chosen = rlcd.reuseServedAsChosen
      ? context.responseText
      : await this.generateText(
          teacher,
          context.format,
          buildPerturbedRequest(context.body, context.format, rlcd.positiveInstruction, model),
        );
    const rejected = await this.generateText(
      teacher,
      context.format,
      buildPerturbedRequest(context.body, context.format, rlcd.negativeInstruction, model),
    );
    const record = buildDpoRecord(readMessages(context.body, context.format), chosen, rejected, {
      decisionId: context.decision.id,
      teacher: teacher.id,
      model,
      reusedServedAsChosen: rlcd.reuseServedAsChosen,
    });
    if (record) await this.deps.sink.append("rlcd-pairs", record);
  }

  private async byteDistill(context: FeedbackContext): Promise<void> {
    const { byteDistill } = this.deps.config.feedback;
    // `logprobs` sólo existe en la API OpenAI; con Anthropic no hay distribución que convertir.
    const teacher = this.teacher("openai");
    if (!teacher || context.format !== "openai") return;
    const model = teacher.models[0] ?? String((context.body as { model?: unknown }).model ?? "");
    const request = structuredClone(context.body) as Record<string, unknown>;
    Object.assign(request, {
      model,
      stream: false,
      temperature: 0,
      logprobs: true,
      top_logprobs: byteDistill.topLogprobs,
    });
    delete request.stream_options;
    const response = await this.deps.transport.sendJson({
      peer: teacher,
      format: "openai",
      body: request,
      hops: 1,
    });
    const tokens = buildByteDistillTokens(readOpenAiLogprobContent(response), byteDistill.method);
    if (tokens.length === 0) return;
    await this.deps.sink.append("byte-distill", {
      decisionId: context.decision.id,
      teacher: teacher.id,
      model,
      method: byteDistill.method,
      prompt: readMessages(context.body, context.format),
      text: tokens.map((token) => token.token).join(""),
      tokens,
    });
  }

  private async layaSoftLabel(context: FeedbackContext): Promise<void> {
    const teacher = this.teacher("openai");
    if (!teacher) return;
    const model = teacher.models[0] ?? "";
    const response = await this.deps.transport.sendJson({
      peer: teacher,
      format: "openai",
      body: buildRouteJudgeRequest(context.features, model, 20),
      hops: 1,
    });
    const softLabel = readRouteJudgeSoftLabel(response);
    if (!softLabel) return;
    await this.deps.sink.append("laya-soft-labels", {
      decisionId: context.decision.id,
      teacher: teacher.id,
      state: layaRouteState(context.features),
      questions: LAYA_ROUTE_QUESTIONS,
      soft_labels: { route: softLabel },
      router: {
        pLocal: context.decision.pLocal,
        tier: context.decision.tier,
        classifier: context.decision.classifier,
      },
    });
  }
}

// Sunsam: una conversación de Sunsam = una sesión de `agy acp`. El turno de agy puede sobrevivir a
// varias llamadas al modelo: cuando agy pide permiso, el stream de Sunsam termina con una pregunta
// al usuario y el turno queda aparcado hasta que llega la respuesta en la siguiente llamada.
import {
  AgyProcess,
  isAgyAuthError,
  readTier,
  resolveAgyPath,
  type AgyConfigOption,
  type AgySessionNewResult,
  type AgyTier,
} from "./agy-process.js";

export type AgyTurnEvent =
  | { readonly kind: "thought"; readonly text: string }
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "tool_call";
      readonly id: string;
      readonly name: string;
      readonly title?: string;
      readonly input: unknown;
    }
  | {
      readonly kind: "tool_result";
      readonly id: string;
      readonly name: string;
      readonly failed: boolean;
      readonly output: string;
    }
  | { readonly kind: "permission"; readonly permission: AgyPermissionRequest }
  | { readonly kind: "end"; readonly stopReason: string; readonly usage?: AgyUsage }
  | { readonly kind: "error"; readonly error: Error };

export interface AgyUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly cachedReadTokens?: number;
  readonly thoughtTokens?: number;
}

export interface AgyPermissionOption {
  readonly optionId: string;
  readonly kind?: string;
  readonly name?: string;
}

export interface AgyPermissionRequest {
  readonly title: string;
  readonly toolKind?: string;
  readonly detail?: string;
  readonly options: readonly AgyPermissionOption[];
  answer(decision: "allow" | "reject"): void;
}

/** Cola de eventos de un turno: agy produce, el stream de Sunsam consume cuando puede. */
export class AgyTurn {
  private readonly events: AgyTurnEvent[] = [];
  private waiter?: () => void;
  ended = false;
  /** Llamadas de agy aún sin resultado; sobreviven a un permiso aparcado entre streams. */
  readonly pendingTools = new Map<string, { readonly name: string; readonly input: unknown }>();
  /** Acciones rechazadas en este turno, para explicarlo si agy termina sin texto. */
  readonly rejected: string[] = [];
  readonly doneTools = new Set<string>();
  textEmitted = false;

  push(event: AgyTurnEvent): void {
    if (this.ended) return;
    if (event.kind === "end" || event.kind === "error") this.ended = true;
    this.events.push(event);
    const waiter = this.waiter;
    this.waiter = undefined;
    waiter?.();
  }

  async next(signal?: AbortSignal): Promise<AgyTurnEvent | undefined> {
    while (this.events.length === 0) {
      if (signal?.aborted) return undefined;
      await new Promise<void>((resolve) => {
        const onAbort = () => resolve();
        this.waiter = () => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        };
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    }
    return this.events.shift();
  }
}

const IDLE_CLOSE_MS = 30 * 60_000;

export class AgyConversation {
  private process?: AgyProcess;
  private ready?: Promise<void>;
  sessionId?: string;
  tier?: AgyTier;
  configOptions: readonly AgyConfigOption[] = [];
  turn?: AgyTurn;
  parked?: { readonly toolCallId: string; readonly permission: AgyPermissionRequest };
  /** «Permitir en esta conversación»: las siguientes peticiones se aprueban solas. */
  allowAll = false;
  /** Huella del último mensaje de usuario enviado, para no reenviarlo en un reintento. */
  lastPromptFingerprint?: string;
  lastUsed = Date.now();
  private idleTimer?: ReturnType<typeof setTimeout>;

  constructor(
    readonly key: string,
    readonly cwd: string,
    private readonly onClosed: (conversation: AgyConversation) => void,
    private readonly env: Record<string, string | undefined> = process.env,
  ) {}

  ensureReady(): Promise<void> {
    if (this.ready && this.process?.alive) return this.ready;
    this.ready = this.open().catch((error: unknown) => {
      this.ready = undefined;
      this.process?.dispose();
      throw toFriendlyError(error);
    });
    return this.ready;
  }

  private async open(): Promise<void> {
    const agy = new AgyProcess(resolveAgyPath(this.env), this.cwd);
    this.process = agy;
    agy.onNotification = (method, params) => this.onNotification(method, params);
    agy.onServerRequest = (method, params) => this.onServerRequest(method, params);
    agy.onExit = (reason) => {
      this.turn?.push({ kind: "error", error: new Error(reason) });
      this.close();
    };
    agy.start();
    await agy.initialize();
    const methodId = this.env.SUNSAM_AGY_AUTH_METHOD?.trim() || "oauth-personal";
    const auth = await agy.request<unknown>("authenticate", { methodId }, 120_000);
    this.tier = readTier(auth);
    const created = await agy.request<AgySessionNewResult>(
      "session/new",
      { cwd: this.cwd, mcpServers: [] },
      60_000,
    );
    this.sessionId = created.sessionId;
    this.configOptions = created.configOptions ?? [];
    this.tier = readTier(created) ?? this.tier;
  }

  private option(category: string): AgyConfigOption | undefined {
    return this.configOptions.find((option) => option.id === category || option.category === category);
  }

  /** Aplica modelo y nivel de razonamiento solo si cambian; las opciones dependen del modelo. */
  async configure(modelId: string, thought: string | undefined): Promise<void> {
    const model = this.option("model");
    if (model && model.currentValue !== modelId) {
      const offered = model.options?.map((entry) => entry.value) ?? [];
      if (offered.length > 0 && !offered.includes(modelId) && !offered.some((v) => modelId.startsWith(`${v}-`))) {
        throw new Error(
          `Tu cuenta de Antigravity no ofrece el modelo «${modelId}». Disponibles: ${offered.join(", ")}.`,
        );
      }
      await this.setOption(model.id, modelId);
    }
    const level = this.option("thought_level");
    if (thought && level && level.currentValue !== thought && level.options?.some((o) => o.value === thought)) {
      await this.setOption(level.id, thought);
    }
  }

  private async setOption(configId: string, value: string): Promise<void> {
    const result = await this.process!.request<{ configOptions?: AgyConfigOption[] }>(
      "session/set_config_option",
      { sessionId: this.sessionId, configId, value },
      30_000,
    );
    if (result?.configOptions) this.configOptions = result.configOptions;
  }

  startTurn(blocks: readonly unknown[]): AgyTurn {
    const turn = new AgyTurn();
    this.turn = turn;
    this.touch();
    this.process!
      .request<{ stopReason?: string; usage?: AgyUsage }>("session/prompt", {
        sessionId: this.sessionId,
        prompt: blocks,
      })
      .then(
        (result) => turn.push({ kind: "end", stopReason: result?.stopReason ?? "end_turn", usage: result?.usage }),
        (error: unknown) => turn.push({ kind: "error", error: toFriendlyError(error) }),
      );
    return turn;
  }

  cancelTurn(): void {
    const turn = this.turn;
    if (!turn || turn.ended) return;
    this.parked?.permission.answer("reject");
    this.parked = undefined;
    this.process?.request("session/cancel", { sessionId: this.sessionId }, 10_000).catch(() => undefined);
  }

  private onNotification(method: string, params: unknown): void {
    if (method !== "session/update") return;
    const update = (params as { update?: Record<string, unknown> } | undefined)?.update;
    if (!update) return;
    const kind = update.sessionUpdate;
    if (kind === "config_option_update" && Array.isArray(update.configOptions)) {
      this.configOptions = update.configOptions as AgyConfigOption[];
      return;
    }
    const turn = this.turn;
    if (!turn || turn.ended) return;
    const text = contentText(update.content);
    if (kind === "agent_thought_chunk" && text) turn.push({ kind: "thought", text });
    else if (kind === "agent_message_chunk" && text) turn.push({ kind: "text", text });
    else if (kind === "tool_call") {
      turn.push({
        kind: "tool_call",
        id: String(update.toolCallId),
        name: String(update.name ?? update.kind ?? "tool"),
        title: typeof update.title === "string" ? update.title : undefined,
        input: update.rawInput ?? update.args ?? {},
      });
      if (update.status === "completed" || update.status === "failed") this.pushToolResult(turn, update);
    } else if (kind === "tool_call_update" && (update.status === "completed" || update.status === "failed")) {
      this.pushToolResult(turn, update);
    }
  }

  private pushToolResult(turn: AgyTurn, update: Record<string, unknown>): void {
    turn.push({
      kind: "tool_result",
      id: String(update.toolCallId),
      name: String(update.name ?? update.kind ?? "tool"),
      failed: update.status === "failed",
      output: toolOutputText(update),
    });
  }

  private onServerRequest(method: string, params: unknown): Promise<unknown> {
    if (method !== "session/request_permission") {
      return Promise.reject(Object.assign(new Error(`Unsupported: ${method}`), { code: -32601 }));
    }
    const request = params as {
      toolCall?: Record<string, unknown>;
      options?: AgyPermissionOption[];
    };
    const options = request.options ?? [];
    const pick = (decision: "allow" | "reject") => {
      const wanted = decision === "allow" ? ["allow_once", "allow_always"] : ["reject_once", "reject_always"];
      const option = wanted.map((kind) => options.find((o) => o.kind === kind)).find(Boolean);
      return option
        ? { outcome: { outcome: "selected", optionId: option.optionId } }
        : { outcome: { outcome: "cancelled" } };
    };
    if (this.allowAll) return Promise.resolve(pick("allow"));
    const turn = this.turn;
    if (!turn || turn.ended) return Promise.resolve(pick("reject"));
    return new Promise((resolve) => {
      const toolCall = request.toolCall ?? {};
      turn.push({
        kind: "permission",
        permission: {
          title: String(toolCall.title ?? toolCall.name ?? "Acción de Antigravity"),
          toolKind: typeof toolCall.kind === "string" ? toolCall.kind : undefined,
          detail: describeRawInput(toolCall.rawInput),
          options,
          answer: (decision) => resolve(pick(decision)),
        },
      });
    });
  }

  touch(): void {
    this.lastUsed = Date.now();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (!this.turn || this.turn.ended) this.close();
      else this.touch();
    }, IDLE_CLOSE_MS);
    this.idleTimer.unref?.();
  }

  close(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.parked?.permission.answer("reject");
    this.parked = undefined;
    const agy = this.process;
    this.process = undefined;
    this.ready = undefined;
    if (agy?.alive && this.sessionId) {
      agy.request("session/close", { sessionId: this.sessionId }, 5_000).catch(() => undefined).finally(() => agy.dispose());
    } else {
      agy?.dispose();
    }
    this.onClosed(this);
  }
}

function contentText(content: unknown): string {
  if (!content) return "";
  if (Array.isArray(content)) return content.map(contentText).join("");
  const record = content as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  if (record.content) return contentText(record.content);
  return "";
}

function toolOutputText(update: Record<string, unknown>): string {
  const text = contentText(update.content);
  if (text) return text.length > 20_000 ? `${text.slice(0, 20_000)}\n…` : text;
  if (update.rawOutput !== undefined) {
    const raw = typeof update.rawOutput === "string" ? update.rawOutput : JSON.stringify(update.rawOutput);
    return raw.length > 20_000 ? `${raw.slice(0, 20_000)}\n…` : raw;
  }
  return update.status === "failed" ? "failed" : "ok";
}

function describeRawInput(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const text = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
  return text.length > 1500 ? `${text.slice(0, 1500)}\n…` : text;
}

export function toFriendlyError(error: unknown): Error {
  const base = error instanceof Error ? error : new Error(String(error));
  if (isAgyAuthError(base) && !/Antigravity/.test(base.message)) {
    return new Error(
      `Antigravity no tiene una sesión de Google activa (${base.message}). Conecta tu cuenta en Ajustes de modelos → Google (Antigravity).`,
    );
  }
  return base;
}

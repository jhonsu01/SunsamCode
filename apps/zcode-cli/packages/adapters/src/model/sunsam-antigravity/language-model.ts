// Sunsam: modelo de lenguaje (interfaz v3 del AI SDK) respaldado por el agente de Google Antigravity.
// agy ejecuta sus propias herramientas; Sunsam las muestra como herramientas del proveedor
// (providerExecuted) y convierte cada petición de permiso de agy en una pregunta en el chat.
import { randomUUID } from "node:crypto";
import { AgyConversation, toFriendlyError, type AgyPermissionRequest, type AgyUsage } from "./conversation.js";
import {
  analyzeTail,
  buildPromptBlocks,
  extractWorkingDirectory,
  fingerprint,
  renderStandalonePrompt,
  toolResultText,
  type V3Message,
} from "./prompt.js";

export const ANTIGRAVITY_BASE_URL_SCHEME = "agy-acp:";
const ASK_TOOL_NAME = "AskUserQuestion";

export function isAntigravityBaseUrl(baseURL: string | undefined): boolean {
  return typeof baseURL === "string" && baseURL.trim().toLowerCase().startsWith(ANTIGRAVITY_BASE_URL_SCHEME);
}

type StreamPart = Record<string, unknown> & { readonly type: string };
interface CallOptions {
  readonly prompt: readonly V3Message[];
  readonly headers?: Record<string, string | undefined>;
  readonly abortSignal?: AbortSignal;
  readonly tools?: ReadonlyArray<{ readonly name: string }>;
}

const conversations = new Map<string, AgyConversation>();

function spanish(): boolean {
  const locale = process.env.SUNSAM_LOCALE ?? process.env.LANG ?? Intl.DateTimeFormat().resolvedOptions().locale;
  return /^es/i.test(locale ?? "");
}

function permissionLabels() {
  return spanish()
    ? { once: "Permitir una vez", session: "Permitir en esta tarea", reject: "Rechazar" }
    : { once: "Allow once", session: "Allow for this task", reject: "Reject" };
}

function permissionQuestion(permission: AgyPermissionRequest): Record<string, unknown> {
  const labels = permissionLabels();
  const es = spanish();
  const detail = permission.detail ? `\n\n${sanitizeForQuestion(permission.detail)}` : "";
  const title = sanitizeForQuestion(permission.title);
  return {
    questions: [
      {
        question: es
          ? `Antigravity quiere ejecutar: ${title}. ¿Lo permites?${detail}`
          : `Antigravity wants to run: ${title}. Allow it?${detail}`,
        header: "Antigravity",
        multiSelect: false,
        options: [
          { label: labels.once, description: es ? "Solo esta acción." : "Only this action." },
          {
            label: labels.session,
            description: es
              ? "Esta y las siguientes acciones de esta conversación, sin volver a preguntar."
              : "This and later actions in this conversation, without asking again.",
          },
          { label: labels.reject, description: es ? "El agente no la ejecuta." : "The agent does not run it." },
        ],
      },
    ],
  };
}

const ALL_LABELS = [
  "Permitir una vez",
  "Permitir en esta tarea",
  "Rechazar",
  "Allow once",
  "Allow for this task",
  "Reject",
];

/**
 * El título y el detalle vienen de agy (y pueden venir de archivos o webs): sin comillas ni
 * etiquetas de las opciones, no pueden imitar una respuesta ni el separador `"="`.
 */
function sanitizeForQuestion(text: string): string {
  let clean = text.replace(/["“”]/g, "'");
  for (const label of ALL_LABELS) clean = clean.split(label).join(label.toLowerCase().replace(/ /g, "_"));
  return clean;
}

/**
 * Solo cuenta la opción elegida: el valor tras `"="` en el resultado de AskUserQuestion,
 * comparado de forma exacta. Cualquier otra cosa (texto libre, sin respuesta) es un rechazo.
 */
export function readDecision(output: unknown): "once" | "session" | "reject" {
  const text = toolResultText(output);
  const answer = /"="([^"]*)"/.exec(text)?.[1]?.trim();
  if (answer === "Permitir en esta tarea" || answer === "Allow for this task") return "session";
  if (answer === "Permitir una vez" || answer === "Allow once") return "once";
  return "reject";
}

function finishReason(stopReason: string): { unified: string; raw: string } {
  const unified =
    stopReason === "max_tokens" ? "length" : stopReason === "refusal" ? "content-filter" : "stop";
  return { unified, raw: stopReason };
}

/**
 * agy informa `inputTokens` SIN los leídos de caché: totalTokens = input + output + cachedRead
 * (medido: 25 780 + 1 091 + 50 619 = 77 490). El total de entrada para Sunsam es la suma; si no,
 * la tasa de aciertos de caché sale por encima del 100 %.
 */
export function toUsage(usage: AgyUsage | undefined) {
  const uncached = usage?.inputTokens;
  const cached = usage?.cachedReadTokens;
  const total = uncached === undefined && cached === undefined ? undefined : (uncached ?? 0) + (cached ?? 0);
  return {
    inputTokens: {
      total,
      noCache: uncached,
      cacheRead: cached,
      cacheWrite: usage?.cachedWriteTokens,
    },
    outputTokens: { total: usage?.outputTokens, text: undefined, reasoning: usage?.thoughtTokens },
    ...(usage ? { raw: { ...usage } } : {}),
  };
}

export class AntigravityLanguageModel {
  readonly specificationVersion = "v3";
  readonly supportedUrls = {};

  constructor(
    readonly provider: string,
    readonly modelId: string,
    private readonly reasoningLevel: string | undefined,
  ) {}

  async doGenerate(options: CallOptions) {
    const { stream } = await this.doStream(options);
    const reader = stream.getReader();
    const content: Record<string, unknown>[] = [];
    let text = "";
    let reasoning = "";
    let finish: StreamPart | undefined;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.type === "text-delta") text += String(value.delta);
      else if (value.type === "reasoning-delta") reasoning += String(value.delta);
      else if (value.type === "tool-call" || value.type === "tool-result") content.push({ ...value });
      else if (value.type === "finish") finish = value;
      else if (value.type === "error") throw value.error;
    }
    if (reasoning) content.unshift({ type: "reasoning", text: reasoning });
    if (text) content.push({ type: "text", text });
    return {
      content,
      finishReason: finish?.finishReason ?? finishReason("end_turn"),
      usage: finish?.usage ?? toUsage(undefined),
      warnings: [],
    };
  }

  async doStream(options: CallOptions) {
    const headers = Object.fromEntries(
      Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
    );
    const sessionKey = headers["x-session-id"];
    const querySource = headers["x-zcode-query-source"];
    const auxiliary = !sessionKey || (querySource !== undefined && querySource !== "main_turn");
    const cwd = extractWorkingDirectory(options.prompt) ?? process.cwd();
    const canAsk = (options.tools ?? []).some((tool) => tool.name === ASK_TOOL_NAME);

    let conversation: AgyConversation;
    if (auxiliary) {
      conversation = new AgyConversation(`aux-${randomUUID()}`, cwd, () => undefined);
    } else {
      const existing = conversations.get(sessionKey!);
      if (existing && existing.cwd !== cwd) existing.close();
      conversation =
        (existing && existing.cwd === cwd ? existing : undefined) ??
        new AgyConversation(sessionKey!, cwd, (closed) => {
          if (conversations.get(closed.key) === closed) conversations.delete(closed.key);
        });
      conversations.set(sessionKey!, conversation);
    }

    const freshSession = !conversation.sessionId;
    await conversation.ensureReady();
    const tail = analyzeTail(options.prompt);
    let turn = conversation.turn;
    const parked = conversation.parked;
    const answer = parked && tail.toolResults.find((r) => r.toolCallId === parked.toolCallId);
    if (!auxiliary && parked && answer && turn && !turn.ended) {
      const decision = readDecision(answer.output);
      if (decision === "session") conversation.allowAll = true;
      if (decision === "reject") turn.rejected.push(parked.permission.title);
      conversation.parked = undefined;
      parked.permission.answer(decision === "reject" ? "reject" : "allow");
    } else {
      if (turn && !turn.ended) {
        conversation.cancelTurn();
        // agy responde al cancelar; se espera a que cierre el turno antes de abrir otro.
        const deadline = Date.now() + 15_000;
        while (!turn.ended && Date.now() < deadline) await turn.next(AbortSignal.timeout(1000));
      }
      conversation.parked = undefined;
      await conversation.configure(this.modelId, this.reasoningLevel);
      const blocks = auxiliary
        ? [{ type: "text", text: renderStandalonePrompt(options.prompt) }]
        : buildPromptBlocks(options.prompt, tail, freshSession);
      if (!auxiliary) conversation.lastPromptFingerprint = fingerprint(tail);
      turn = conversation.startTurn(blocks);
    }
    const activeTurn = turn!;
    const signal = options.abortSignal;

    const stream = new ReadableStream<StreamPart>({
      start: async (controller) => {
        let textId: string | undefined;
        let reasoningId: string | undefined;
        let emitted = false;
        const pending = activeTurn.pendingTools;
        const rejected = activeTurn.rejected;
        const emitTool = (id: string, name: string, input: unknown, output: string, failed: boolean) => {
          controller.enqueue({
            type: "tool-call",
            toolCallId: id,
            toolName: name,
            input: JSON.stringify(input ?? {}),
            providerExecuted: true,
            dynamic: true,
          });
          controller.enqueue({ type: "tool-result", toolCallId: id, toolName: name, result: output, isError: failed, dynamic: true });
          emitted = true;
        };
        const closeText = () => {
          if (textId) controller.enqueue({ type: "text-end", id: textId });
          textId = undefined;
        };
        const closeReasoning = () => {
          if (reasoningId) controller.enqueue({ type: "reasoning-end", id: reasoningId });
          reasoningId = undefined;
        };
        const closeAll = () => {
          closeReasoning();
          closeText();
        };
        controller.enqueue({ type: "stream-start", warnings: [] });
        try {
          for (;;) {
            const event = await activeTurn.next(signal);
            if (!event) {
              conversation.cancelTurn();
              closeAll();
              controller.close();
              if (auxiliary) conversation.close();
              return;
            }
            conversation.touch();
            switch (event.kind) {
              case "thought":
                closeText();
                if (!reasoningId) {
                  reasoningId = randomUUID();
                  controller.enqueue({ type: "reasoning-start", id: reasoningId });
                }
                controller.enqueue({ type: "reasoning-delta", id: reasoningId, delta: event.text });
                break;
              case "text":
                closeReasoning();
                if (!textId) {
                  textId = randomUUID();
                  controller.enqueue({ type: "text-start", id: textId });
                }
                controller.enqueue({ type: "text-delta", id: textId, delta: event.text });
                emitted = true;
                activeTurn.textEmitted = true;
                break;
              case "tool_call":
                // La tarjeta se emite al terminar (llamada + resultado juntos): si agy pide permiso
                // entre medias, el stream se corta y una llamada sin resultado quedaría interrumpida.
                if (!pending.has(event.id)) pending.set(event.id, { name: event.name, input: event.input });
                break;
              case "tool_result": {
                const call = pending.get(event.id);
                if (call === undefined && activeTurn.doneTools.has(event.id)) break;
                pending.delete(event.id);
                activeTurn.doneTools.add(event.id);
                closeAll();
                emitTool(event.id, call?.name ?? event.name, call?.input, event.output, event.failed);
                break;
              }
              case "permission": {
                if (auxiliary || !canAsk) {
                  rejected.push(event.permission.title);
                  event.permission.answer("reject");
                  break;
                }
                closeAll();
                const toolCallId = `agy_permission_${randomUUID()}`;
                conversation.parked = { toolCallId, permission: event.permission };
                controller.enqueue({
                  type: "tool-call",
                  toolCallId,
                  toolName: ASK_TOOL_NAME,
                  input: JSON.stringify(permissionQuestion(event.permission)),
                });
                controller.enqueue({
                  type: "finish",
                  finishReason: { unified: "tool-calls", raw: "permission" },
                  usage: toUsage(undefined),
                });
                controller.close();
                return;
              }
              case "end":
                closeAll();
                // agy no siempre cierra una llamada rechazada o cancelada: sin resultado, la tarjeta
                // quedaría abierta y el historial tendría un tool_use sin respuesta.
                for (const [id, call] of pending) {
                  emitTool(
                    id,
                    call.name,
                    call.input,
                    spanish() ? "No se ejecutó (sin permiso o cancelada)." : "Not run (not permitted or cancelled).",
                    true,
                  );
                }
                pending.clear();
                if (rejected.length > 0 && !activeTurn.textEmitted) {
                  textId = randomUUID();
                  controller.enqueue({ type: "text-start", id: textId });
                  controller.enqueue({
                    type: "text-delta",
                    id: textId,
                    delta: spanish()
                      ? `Antigravity terminó porque no tuvo permiso para: ${rejected.join("; ")}.`
                      : `Antigravity stopped because it was not allowed to: ${rejected.join("; ")}.`,
                  });
                  emitted = true;
                }
                if (!emitted && !textId) {
                  textId = randomUUID();
                  controller.enqueue({ type: "text-start", id: textId });
                  controller.enqueue({
                    type: "text-delta",
                    id: textId,
                    delta: spanish() ? "(Antigravity terminó sin respuesta.)" : "(Antigravity finished without a reply.)",
                  });
                }
                closeAll();
                controller.enqueue({
                  type: "finish",
                  finishReason: finishReason(event.stopReason),
                  usage: toUsage(event.usage),
                });
                controller.close();
                if (auxiliary) conversation.close();
                return;
              case "error":
                closeAll();
                controller.enqueue({ type: "error", error: toFriendlyError(event.error) });
                controller.close();
                if (auxiliary) conversation.close();
                return;
            }
          }
        } catch (error) {
          controller.enqueue({ type: "error", error: toFriendlyError(error) });
          controller.close();
          if (auxiliary) conversation.close();
        }
      },
      cancel: () => {
        if (!conversation.parked) conversation.cancelTurn();
        if (auxiliary) conversation.close();
      },
    });
    return { stream, request: { body: { provider: "antigravity-acp", model: this.modelId } } };
  }
}

/** Fábrica compatible con la de los SDK: un modelo por id. */
export function createAntigravityProvider(options: { readonly name: string; readonly reasoningLevel?: string }) {
  return (modelId: string) => new AntigravityLanguageModel(options.name, modelId, options.reasoningLevel);
}

/** Solo para pruebas y apagado: cierra todas las sesiones de agy abiertas. */
export function closeAllAntigravityConversations(): void {
  for (const conversation of [...conversations.values()]) conversation.close();
}

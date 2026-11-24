// Sunsam: lectura del prompt de Sunsam (formato LanguageModelV3) para el agente de Antigravity.
// agy guarda su propio historial: solo se le envía lo nuevo desde el último mensaje del asistente.

export interface V3TextPart {
  readonly type: "text";
  readonly text: string;
}
export interface V3FilePart {
  readonly type: "file";
  readonly data: unknown;
  readonly mediaType: string;
  readonly filename?: string;
}
export interface V3ToolCallPart {
  readonly type: "tool-call";
  readonly toolCallId: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly providerExecuted?: boolean;
}
export interface V3ToolResultPart {
  readonly type: "tool-result";
  readonly toolCallId: string;
  readonly toolName: string;
  readonly output: unknown;
}
export type V3Message =
  | { readonly role: "system"; readonly content: string }
  | { readonly role: "user"; readonly content: ReadonlyArray<V3TextPart | V3FilePart> }
  | { readonly role: "assistant"; readonly content: ReadonlyArray<{ readonly type: string } & Record<string, unknown>> }
  | { readonly role: "tool"; readonly content: ReadonlyArray<{ readonly type: string } & Record<string, unknown>> };

const CWD_PATTERN = /Primary working directory:\s*([^\r\n]+)/g;

/** Carpeta de trabajo que Sunsam anuncia en su bloque de entorno (la última gana). */
export function extractWorkingDirectory(prompt: readonly V3Message[]): string | undefined {
  let found: string | undefined;
  for (const message of prompt) {
    for (const text of messageTexts(message)) {
      for (const match of text.matchAll(CWD_PATTERN)) {
        const value = match[1]!.replace(/\s*\(was [^)]*\)\s*$/, "").replace(/^[`"']|[`"']$/g, "").trim();
        if (value) found = value;
      }
    }
  }
  return found;
}

function messageTexts(message: V3Message): string[] {
  if (message.role === "system") return [message.content];
  return message.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text);
}

export interface PromptTail {
  /** Mensajes de usuario posteriores a la última respuesta del asistente. */
  readonly userMessages: ReadonlyArray<Extract<V3Message, { role: "user" }>>;
  /** Resultados de herramientas del cliente posteriores a la última respuesta. */
  readonly toolResults: readonly V3ToolResultPart[];
  /** Hubo respuestas del asistente antes (historial previo a esta sesión de agy). */
  readonly hasHistory: boolean;
  readonly lastAssistantIndex: number;
}

export function analyzeTail(prompt: readonly V3Message[]): PromptTail {
  let lastAssistantIndex = -1;
  prompt.forEach((message, index) => {
    if (message.role === "assistant") lastAssistantIndex = index;
  });
  const after = prompt.slice(lastAssistantIndex + 1);
  return {
    userMessages: after.filter((m): m is Extract<V3Message, { role: "user" }> => m.role === "user"),
    toolResults: after
      .filter((m) => m.role === "tool")
      .flatMap((m) => (m.content as ReadonlyArray<Record<string, unknown>>).filter((p) => p.type === "tool-result"))
      .map((p) => p as unknown as V3ToolResultPart),
    hasHistory: lastAssistantIndex >= 0,
    lastAssistantIndex,
  };
}

/** Bloques ACP del turno: texto e imágenes de los mensajes nuevos, con el historial si agy no lo tiene. */
export function buildPromptBlocks(
  prompt: readonly V3Message[],
  tail: PromptTail,
  includeHistory: boolean,
): unknown[] {
  const blocks: unknown[] = [];
  if (includeHistory && tail.hasHistory) {
    const transcript = renderTranscript(prompt.slice(0, tail.lastAssistantIndex + 1));
    if (transcript) {
      blocks.push({
        type: "text",
        text: `Conversation so far (from Sunsam Code, for context):\n\n${transcript}\n\n---\nNew message:`,
      });
    }
  }
  for (const message of tail.userMessages) {
    for (const part of message.content) {
      if (part.type === "text" && part.text.trim()) blocks.push({ type: "text", text: part.text });
      else if (part.type === "file") {
        const image = toImageBlock(part);
        if (image) blocks.push(image);
        else if (part.filename) blocks.push({ type: "text", text: `[Attached file: ${part.filename}]` });
      }
    }
  }
  if (blocks.length === 0) blocks.push({ type: "text", text: "Continue." });
  return blocks;
}

function toImageBlock(part: V3FilePart): unknown {
  if (!part.mediaType.startsWith("image/")) return undefined;
  let data: string | undefined;
  if (typeof part.data === "string" && !/^https?:/.test(part.data)) data = part.data.replace(/^data:[^,]*,/, "");
  else if (part.data instanceof Uint8Array) data = Buffer.from(part.data).toString("base64");
  return data ? { type: "image", mimeType: part.mediaType, data } : undefined;
}

const MAX_TRANSCRIPT_CHARS = 60_000;

/** Historial plano: usuario y respuestas de texto. Las herramientas de otros modelos no viajan. */
export function renderTranscript(messages: readonly V3Message[]): string {
  const lines: string[] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = messageTexts(message).join("\n").trim();
    if (!text) continue;
    lines.push(`${message.role === "user" ? "User" : "Assistant"}: ${text}`);
  }
  const joined = lines.join("\n\n");
  return joined.length > MAX_TRANSCRIPT_CHARS ? `…${joined.slice(-MAX_TRANSCRIPT_CHARS)}` : joined;
}

/** Consulta auxiliar (título, compactación…): todo el prompt como un único texto. */
export function renderStandalonePrompt(prompt: readonly V3Message[]): string {
  const parts: string[] = [];
  for (const message of prompt) {
    const text = messageTexts(message).join("\n").trim();
    if (!text) continue;
    if (message.role === "system") parts.push(`<instructions>\n${text}\n</instructions>`);
    else parts.push(`${message.role === "user" ? "User" : "Assistant"}: ${text}`);
  }
  parts.push(
    "Answer the last user message directly in plain text. Do not use any tools and do not modify files.",
  );
  return parts.join("\n\n");
}

export function fingerprint(tail: PromptTail): string {
  const text = tail.userMessages.flatMap((m) => m.content.map((p) => (p.type === "text" ? p.text : p.mediaType))).join("\u0000");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (Math.imul(hash, 31) + text.charCodeAt(i)) | 0;
  return `${tail.lastAssistantIndex}:${text.length}:${hash}`;
}

export function toolResultText(output: unknown): string {
  if (output === undefined || output === null) return "";
  if (typeof output === "string") return output;
  const record = output as { type?: string; value?: unknown };
  if (typeof record.value === "string") return record.value;
  return JSON.stringify(record.value ?? output);
}

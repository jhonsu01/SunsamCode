/**
 * Lectura pura de cuerpos de petición OpenAI (`/v1/chat/completions`) y Anthropic (`/v1/messages`).
 * Sólo extrae lo que necesitan el router y los trabajos de feedback; no valida el esquema completo
 * (eso lo hace el peer que recibe la petición).
 */

export type ApiFormat = "openai" | "anthropic";

export interface ChatMessageText {
  role: string;
  text: string;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Texto plano de un `content` (string o lista de bloques `text`). */
function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => (isRecord(block) && typeof block.text === "string" ? block.text : ""))
    .filter(Boolean)
    .join("\n");
}

export function contentHasImage(content: unknown): boolean {
  return (
    Array.isArray(content) &&
    content.some(
      (block) => isRecord(block) && (block.type === "image" || block.type === "image_url"),
    )
  );
}

/** Mensajes normalizados; en Anthropic el `system` se antepone como mensaje `system`. */
export function readMessages(body: unknown, format: ApiFormat): ChatMessageText[] {
  if (!isRecord(body)) return [];
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const result: ChatMessageText[] = [];
  if (format === "anthropic" && body.system !== undefined) {
    result.push({ role: "system", text: contentText(body.system) });
  }
  for (const message of messages) {
    if (!isRecord(message)) continue;
    result.push({ role: String(message.role ?? "user"), text: contentText(message.content) });
  }
  return result;
}

/** ¿El último mensaje es la continuación de un bucle agente (resultado de herramienta)? */
export function isToolContinuation(body: unknown, format: ApiFormat): boolean {
  if (!isRecord(body) || !Array.isArray(body.messages)) return false;
  const last = body.messages.at(-1);
  if (!isRecord(last)) return false;
  if (format === "openai") return last.role === "tool";
  return (
    Array.isArray(last.content) &&
    last.content.some((block) => isRecord(block) && block.type === "tool_result")
  );
}

export function readModel(body: unknown): string {
  return isRecord(body) && typeof body.model === "string" ? body.model : "";
}

export function readToolCount(body: unknown): number {
  return isRecord(body) && Array.isArray(body.tools) ? body.tools.length : 0;
}

export function withModel(body: unknown, model: string): JsonRecord {
  return { ...(isRecord(body) ? body : {}), model };
}

/** Clave estable de conversación: primer mensaje de usuario (el bucle agente sólo añade mensajes). */
export function conversationSeed(body: unknown, format: ApiFormat): string {
  const firstUser = readMessages(body, format).find((message) => message.role === "user");
  return firstUser?.text ?? "";
}

/** Hash FNV-1a de 32 bits (puro, suficiente para claves de caché; no es criptográfico). */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

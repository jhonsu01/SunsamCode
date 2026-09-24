/**
 * Sunsam: 为“任意 JSON 值”的子 schema 补上显式类型联合。
 *
 * 原因：`{ "description": "..." }` 这种没有 type 的子 schema 在 JSON Schema 中表示“任意值”，
 * 但 LM Studio 等内置的旧版 llama.cpp（json-schema-to-grammar，约 b6000）会报
 * “Unrecognized schema”，随后整份工具语法解析失败，返回
 * `Failed to initialize samplers: failed to parse grammar`。由于每次请求都会携带全部工具，
 * 一个工具（workflow / save_workflow / submit_result 的 args 字段）就会让所有模型都报错。
 * 修复依据：补上 `type: [全部 JSON 类型]` 与原 schema 语义完全相同，新旧 llama.cpp 都能转换。
 */
import type { JsonSchema } from "@zcode/contracts";

const ANY_JSON_TYPE = ["string", "number", "integer", "boolean", "object", "array", "null"];

/** Palabras clave que ya restringen el tipo: si aparece alguna, el nodo no es "cualquier valor". */
const TYPE_DEFINING_KEYS = [
  "type",
  "anyOf",
  "oneOf",
  "allOf",
  "not",
  "$ref",
  "enum",
  "const",
  "properties",
  "items",
  "prefixItems",
  "additionalProperties",
  "patternProperties",
  "if",
];

const SCHEMA_MAP_KEYS = ["properties", "patternProperties", "$defs", "definitions"];
const SCHEMA_LIST_KEYS = ["anyOf", "oneOf", "allOf", "prefixItems"];
const SCHEMA_VALUE_KEYS = ["items", "additionalProperties", "not", "if", "then", "else"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNode(node: unknown): unknown {
  if (!isRecord(node)) return node;
  const next: Record<string, unknown> = { ...node };
  for (const key of SCHEMA_MAP_KEYS) {
    const map = next[key];
    if (isRecord(map)) {
      next[key] = Object.fromEntries(
        Object.entries(map).map(([name, child]) => [name, normalizeNode(child)]),
      );
    }
  }
  for (const key of SCHEMA_LIST_KEYS) {
    const list = next[key];
    if (Array.isArray(list)) next[key] = list.map(normalizeNode);
  }
  for (const key of SCHEMA_VALUE_KEYS) {
    if (isRecord(next[key])) next[key] = normalizeNode(next[key]);
  }
  if (!TYPE_DEFINING_KEYS.some((key) => key in next)) {
    next.type = ANY_JSON_TYPE;
  }
  return next;
}

/** Devuelve una copia del schema de entrada con los nodos "cualquier valor" tipados explícitamente. */
export function withExplicitAnyTypes(schema: JsonSchema): JsonSchema {
  return normalizeNode(schema) as JsonSchema;
}

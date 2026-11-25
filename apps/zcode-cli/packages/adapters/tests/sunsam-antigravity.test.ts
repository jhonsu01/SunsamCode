// Sunsam: proveedor Google Antigravity (agy acp) a través del AI SDK real, con un agy simulado.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jsonSchema, streamText, tool, type LanguageModel, type ModelMessage } from "ai";
import {
  closeAllAntigravityConversations,
  createAntigravityProvider,
  isAntigravityBaseUrl,
  readDecision,
  toUsage,
} from "../src/model/sunsam-antigravity/language-model.js";
import { extractWorkingDirectory } from "../src/model/sunsam-antigravity/prompt.js";
import { mcpStem, readAgyPluginMcpStems, toAcpMcpServers } from "../src/model/sunsam-antigravity/mcp-servers.js";
import type { McpServerConfig } from "@zcode/contracts";

const here = path.dirname(fileURLToPath(import.meta.url));
const workDir = mkdtempSync(path.join(tmpdir(), "sunsam-agy-"));
const recordFile = path.join(workDir, "record.jsonl");
const model = createAntigravityProvider({ name: "Google (Antigravity)", reasoningLevel: "medium" })(
  "gemini-3.8-flash",
) as unknown as LanguageModel;

const askTool = tool({
  description: "ask",
  inputSchema: jsonSchema<Record<string, unknown>>({ type: "object", additionalProperties: true }),
});

const system = `# Environment\n - Primary working directory: ${workDir}\n - Platform: win32`;

async function run(messages: ModelMessage[], sessionId: string, withAsk = true) {
  const result = streamText({
    model,
    system,
    messages,
    headers: { "x-session-id": sessionId, "x-zcode-query-source": "main_turn" },
    ...(withAsk ? { tools: { AskUserQuestion: askTool } } : {}),
  });
  const parts: Array<Record<string, unknown>> = [];
  for await (const part of result.fullStream) parts.push(part as Record<string, unknown>);
  return { parts, text: parts.filter((p) => p.type === "text-delta").map((p) => p.text).join("") };
}

function recorded(): Array<Record<string, unknown>> {
  try {
    return readFileSync(recordFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch {
    return [];
  }
}

beforeAll(() => {
  process.env.SUNSAM_AGY_PATH = path.join(here, "fixtures", "sunsam-mock-agy.cjs");
  process.env.MOCK_AGY_RECORD = recordFile;
  process.env.SUNSAM_LOCALE = "es-ES";
});
afterAll(() => closeAllAntigravityConversations());

describe("Sunsam Antigravity provider", () => {
  it("reconoce la URL agy-acp y la carpeta de trabajo del prompt", () => {
    expect(isAntigravityBaseUrl("agy-acp://local")).toBe(true);
    expect(isAntigravityBaseUrl("https://api.z.ai")).toBe(false);
    expect(
      extractWorkingDirectory([
        { role: "system", content: " - Primary working directory: D:\\a (was D:\\b)" },
      ]),
    ).toBe("D:\\a");
  });

  it("transmite razonamiento y texto, y fija el modelo y la carpeta", async () => {
    const { parts, text } = await run([{ role: "user", content: "hola SCRIPT:TEXT" }], "s-text");
    expect(text).toContain("Hola.");
    expect(parts.some((p) => p.type === "reasoning-delta")).toBe(true);
    expect(parts.find((p) => p.type === "finish")).toMatchObject({ finishReason: "stop" });
    const log = recorded();
    expect(log.find((e) => e.method === "session/new")).toMatchObject({ cwd: workDir });
    expect(
      log.some(
        (e) =>
          e.method === "session/set_config_option" &&
          (e.params as { configId?: string; value?: string }).configId === "thought_level" &&
          (e.params as { value?: string }).value === "medium",
      ),
    ).toBe(true);
  });

  it("convierte un permiso en AskUserQuestion y continúa el mismo turno con la respuesta", async () => {
    const first = await run([{ role: "user", content: "edita SCRIPT:EDIT" }], "s-edit");
    const ask = first.parts.find((p) => p.type === "tool-call" && p.toolName === "AskUserQuestion");
    expect(ask).toBeDefined();
    expect(first.parts.find((p) => p.type === "finish")).toMatchObject({ finishReason: "tool-calls" });
    const input = ask!.input as { questions: Array<{ options: Array<{ label: string }> }> };
    expect(input.questions[0]!.options.map((o) => o.label)).toEqual([
      "Permitir una vez",
      "Permitir en esta tarea",
      "Rechazar",
    ]);

    const second = await run(
      [
        { role: "user", content: "edita SCRIPT:EDIT" },
        {
          role: "assistant",
          content: [
            { type: "tool-call", toolCallId: String(ask!.toolCallId), toolName: "AskUserQuestion", input: input },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: String(ask!.toolCallId),
              toolName: "AskUserQuestion",
              output: { type: "text", value: 'User answered: "¿Lo permites?"="Permitir una vez"' },
            },
          ],
        },
      ],
      "s-edit",
    );
    expect(second.text).toContain("Edit applied.");
    const toolResult = second.parts.find((p) => p.type === "tool-result");
    expect(toolResult).toMatchObject({ providerExecuted: true });
    expect(recorded().some((e) => e.evt === "permission" && e.allowed === true)).toBe(true);
    // Un solo session/prompt: la respuesta continúa el turno aparcado, no abre otro.
    const prompts = recorded().filter((e) => e.method === "session/prompt" && JSON.stringify(e.params).includes("SCRIPT:EDIT"));
    expect(prompts).toHaveLength(1);
  });

  it("suma la caché al total de entrada (agy la informa aparte)", () => {
    // Medido con agy 1.5.15: inputTokens 25780 + output 1091 + cachedRead 50619 = totalTokens 77490.
    const usage = toUsage({ inputTokens: 25_780, outputTokens: 1_091, cachedReadTokens: 50_619, thoughtTokens: 682 });
    expect(usage.inputTokens).toMatchObject({ total: 76_399, noCache: 25_780, cacheRead: 50_619 });
    expect(usage.inputTokens.cacheRead! / usage.inputTokens.total!).toBeLessThanOrEqual(1);
    expect(usage.outputTokens).toMatchObject({ total: 1_091, reasoning: 682 });
  });

  it("solo acepta la opción elegida, no texto de agy repetido en la pregunta", () => {
    const answer = (question: string, choice: string) => ({
      type: "text",
      value: `User has answered your questions: "${question}"="${choice}". You can now continue.`,
    });
    expect(readDecision(answer("¿Lo permites?", "Permitir en esta tarea"))).toBe("session");
    expect(readDecision(answer("¿Lo permites?", "Permitir una vez"))).toBe("once");
    // Un título malicioso con la etiqueta, y la respuesta real «Rechazar».
    expect(readDecision(answer("Antigravity quiere ejecutar: Permitir en esta tarea", "Rechazar"))).toBe("reject");
    // Texto libre («Other») o sin respuesta: rechazo.
    expect(readDecision(answer("¿Lo permites?", "sí, permitir en esta tarea por favor"))).toBe("reject");
    expect(readDecision({ type: "text", value: "The user did not provide answers" })).toBe("reject");
  });

  it("rechaza el permiso si la conversación no puede preguntar", async () => {
    const { text } = await run([{ role: "user", content: "otra SCRIPT:MCP_TOOL" }], "s-noask", false);
    expect(text).toContain("Tool not allowed.");
  });

  it("muestra un error claro si agy falla", async () => {
    const { parts } = await run([{ role: "user", content: "x SCRIPT:ERR" }], "s-err");
    const error = parts.find((p) => p.type === "error");
    expect(String((error?.error as Error | undefined)?.message)).toContain("Quota exceeded");
  });
});

describe("Sunsam Antigravity: MCP de Sunsam en agy", () => {
  const servers: Record<string, McpServerConfig> = {
    "photocraft-mcp-server": { type: "stdio", command: "node", args: ["C:/x/photo.cjs"], env: { PHOTO_DIR: "C:/P" } },
    "gridcraft-mcp-server": { type: "stdio", command: "node", args: ["C:/x/grid.cjs"] },
    "DeckCraft Bridge": { type: "stdio", command: "node", args: ["C:/x/deck.cjs"], enabled: false },
    proyecto: { type: "stdio", command: "node", source: { kind: "workspace" } },
    node_repl: { type: "stdio", command: "node_repl.exe" },
    "antigravity-acp-mcp": { type: "stdio", command: "node", args: ["C:/x/agy.js"] },
    oficial: { type: "http", url: "https://z.ai/mcp", auth: { type: "zcode_official", provider: "jwt_token" } },
    oauth: { type: "http", url: "https://a.example/mcp", oauth: { type: "authorization_code" } },
    Composio: { type: "http", url: "https://connect.example/mcp", headers: { "x-api-key": "k" } },
  };

  it("normaliza nombres para comparar con los plugins de agy", () => {
    expect(mcpStem("gridcraft-mcp-server")).toBe("gridcraft");
    expect(mcpStem("gridcraft_mcp")).toBe("gridcraft");
    expect(mcpStem("GridCraft Bridge")).toBe("gridcraft");
    expect(mcpStem("MCP_DOCKER")).toBe("docker");
  });

  it("pasa solo los servidores utilizables y no duplica los plugins de agy", () => {
    const { servers: acp, skipped } = toAcpMcpServers(servers, new Set(["gridcraft"]));
    expect(acp).toEqual([
      { name: "photocraft-mcp-server", command: "node", args: ["C:/x/photo.cjs"], env: [{ name: "PHOTO_DIR", value: "C:/P" }] },
      { type: "http", name: "Composio", url: "https://connect.example/mcp", headers: [{ name: "x-api-key", value: "k" }] },
    ]);
    expect(Object.fromEntries(skipped.map((s) => [s.name, s.reason]))).toEqual({
      "gridcraft-mcp-server": "agy-plugin",
      "DeckCraft Bridge": "disabled",
      proyecto: "workspace",
      node_repl: "builtin",
      "antigravity-acp-mcp": "antigravity-bridge",
      oficial: "official-auth",
      oauth: "oauth",
    });
  });

  it("lee los plugins de agy instalados y respeta los desactivados", () => {
    const home = mkdtempSync(path.join(tmpdir(), "sunsam-agy-home-"));
    const plugins = path.join(home, ".gemini", "config", "plugins");
    for (const name of ["wordcraft", "apagado", "sin-mcp"]) mkdirSync(path.join(plugins, name), { recursive: true });
    writeFileSync(path.join(plugins, "wordcraft", "mcp_config.json"), JSON.stringify({ mcpServers: { wordcraft_mcp: {} } }));
    writeFileSync(path.join(plugins, "apagado", "mcp_config.json"), JSON.stringify({ mcpServers: { apagado_mcp: {} } }));
    writeFileSync(
      path.join(home, ".gemini", "config", "config.json"),
      JSON.stringify({ plugins: { apagado: { enabled: false } } }),
    );
    expect([...readAgyPluginMcpStems(home)]).toEqual(["wordcraft"]);
  });

  it("abre la sesión de agy con los MCP de Sunsam y la reabre si cambian", async () => {
    let current: Record<string, McpServerConfig> = { "photocraft-mcp-server": servers["photocraft-mcp-server"]! };
    const withMcp = createAntigravityProvider({ name: "Google (Antigravity)", getMcpServers: () => current })(
      "gemini-3.8-flash",
    ) as unknown as LanguageModel;
    const ask = async (content: string) => {
      const result = streamText({
        model: withMcp,
        system,
        messages: [{ role: "user", content }],
        headers: { "x-session-id": "s-mcp", "x-zcode-query-source": "main_turn" },
      });
      for await (const _ of result.fullStream) void _;
    };
    const sessions = () => recorded().filter((r) => r.method === "session/new");
    const before = sessions().length;
    await ask("hola SCRIPT:TEXT");
    await ask("otra vez SCRIPT:TEXT");
    expect(sessions().length - before).toBe(1);
    expect(sessions().at(-1)?.mcpServers).toEqual([
      { name: "photocraft-mcp-server", command: "node", args: ["C:/x/photo.cjs"], env: [{ name: "PHOTO_DIR", value: "C:/P" }] },
    ]);
    current = {};
    await ask("sin mcp SCRIPT:TEXT");
    expect(sessions().length - before).toBe(2);
    expect(sessions().at(-1)?.mcpServers).toEqual([]);
  });
});

// Sunsam: prueba contra el `agy` real y la cuenta de Google del usuario. Gasta cuota:
// solo corre con SUNSAM_AGY_LIVE=1. Responde «Permitir una vez» a cada permiso, como haría el usuario.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { jsonSchema, streamText, tool, type LanguageModel, type ModelMessage } from "ai";
import {
  closeAllAntigravityConversations,
  createAntigravityProvider,
} from "../src/model/sunsam-antigravity/language-model.js";

afterAll(() => closeAllAntigravityConversations());

const askTool = tool({
  description: "ask",
  inputSchema: jsonSchema<Record<string, unknown>>({ type: "object", additionalProperties: true }),
});

describe.runIf(process.env.SUNSAM_AGY_LIVE === "1")("Antigravity live", () => {
  it("lee un archivo con Gemini 3.8 Flash", { timeout: 300_000 }, async () => {
    process.env.SUNSAM_LOCALE = "es-ES";
    const dir = mkdtempSync(path.join(tmpdir(), "sunsam-agy-live-"));
    writeFileSync(path.join(dir, "nota.txt"), "La clave es TULIPAN-77.\n");
    const model = createAntigravityProvider({ name: "Google (Antigravity)", reasoningLevel: "low" })(
      process.env.SUNSAM_AGY_MODEL ?? "gemini-3.8-flash",
    ) as unknown as LanguageModel;
    const sessionId = `live-${Date.now()}`;
    const messages: ModelMessage[] = [
      { role: "user", content: "Lee nota.txt de la carpeta de trabajo y responde solo con la clave. No modifiques nada." },
    ];
    let text = "";
    const kinds: string[] = [];
    for (let round = 0; round < 4; round += 1) {
      const result = streamText({
        model,
        system: ` - Primary working directory: ${dir}`,
        messages,
        tools: { AskUserQuestion: askTool },
        headers: { "x-session-id": sessionId, "x-zcode-query-source": "main_turn" },
      });
      let ask: { toolCallId: string; input: unknown } | undefined;
      for await (const part of result.fullStream) {
        kinds.push(part.type);
        if (part.type === "text-delta") text += part.text;
        if (part.type === "tool-call") console.log("tool-call", part.toolName, JSON.stringify(part.input).slice(0, 200));
        if (part.type === "tool-result") console.log("tool-result", JSON.stringify(part.output).slice(0, 200));
        if (part.type === "tool-call" && part.toolName === "AskUserQuestion") ask = part;
        if (part.type === "error") console.log("error", part.error);
      }
      console.log(`round ${round} usage`, JSON.stringify(await result.totalUsage));
      if (!ask) break;
      messages.push(
        { role: "assistant", content: [{ type: "tool-call", toolCallId: ask.toolCallId, toolName: "AskUserQuestion", input: ask.input }] },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: ask.toolCallId,
              toolName: "AskUserQuestion",
              output: { type: "text", value: '"Permiso"="Permitir una vez"' },
            },
          ],
        },
      );
    }
    console.log("text:", text);
    expect(text).toContain("TULIPAN-77");
    expect(kinds).toContain("tool-result");
  });
});

/**
 * Sunsam: la configuración de los modelos de Google (Antigravity) cumple el esquema de modelos
 * manuales, que es el que valida `addPersonalModel`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { manualModelConfigSchema } from "@zcode/provider";
import { isSunsamAntigravityBaseUrl, sunsamAntigravityModelConfig } from "@zcode/shared";

test("la config de un modelo con niveles de razonamiento es un modelo manual válido", () => {
  const config = sunsamAntigravityModelConfig({
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    thoughtLevels: ["low", "medium", "high"],
  });
  const parsed = manualModelConfigSchema.safeParse(config);
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
  assert.deepEqual(config.optionSpecs.reasoningLevel.values, ["low", "medium", "high"]);
});

test("un modelo sin niveles (Claude, GPT-OSS) también es válido", () => {
  const parsed = manualModelConfigSchema.safeParse(
    sunsamAntigravityModelConfig({ id: "claude-sonnet-4-6", name: "Claude", thoughtLevels: [] }),
  );
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
});

test("reconoce la URL del proveedor", () => {
  assert.equal(isSunsamAntigravityBaseUrl("agy-acp://local"), true);
  assert.equal(isSunsamAntigravityBaseUrl("https://api.z.ai"), false);
  assert.equal(isSunsamAntigravityBaseUrl(undefined), false);
});

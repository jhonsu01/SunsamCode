/**
 * Sunsam: la configuración de los modelos de Google (Antigravity) cumple el esquema de modelos
 * manuales, que es el que valida `addPersonalModel`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { manualModelConfigSchema } from "@zcode/provider";
import {
  isSunsamAntigravityBaseUrl,
  parseSunsamAntigravityQuota,
  sunsamAntigravityModelConfig,
} from "@zcode/shared";

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

test("interpreta la salida real de agy -p /usage y /credits", () => {
  // Salida medida con agy 1.5.15 (2026-11-24), cuenta «Antigravity Starter Quota».
  const usage = {
    status: "SUCCESS",
    command: {
      name: "usage",
      data: {
        description: "Within each group, models share a weekly limit.",
        groups: [
          {
            name: "Gemini Models",
            description: "Models within this group: Gemini 4 Hydrogen, Gemini 3.8 Flash",
            buckets: [
              {
                id: "gemini-weekly",
                name: "Weekly Limit Remaining",
                window: "weekly",
                remaining_fraction: 0.614852786064148,
                reset_time: "2026-12-01T01:00:08Z",
              },
            ],
          },
          {
            name: "Claude and GPT models",
            buckets: [{ id: "3p-weekly", name: "Weekly Limit Remaining", window: "weekly", remaining_fraction: 1, reset_time: "2026-12-01T20:24:02Z" }],
          },
        ],
      },
    },
  };
  const credits = { status: "SUCCESS", command: { name: "credits", data: { remaining_credits: 0, upgrade_uri: "https://antigravity.google/g1-upgrade" } } };
  const quota = parseSunsamAntigravityQuota(usage, credits, new Date("2026-11-24T20:00:00Z"));
  assert.equal(quota.groups.length, 2);
  assert.equal(quota.groups[0]!.buckets[0]!.window, "weekly");
  assert.ok(Math.abs(quota.groups[0]!.buckets[0]!.remainingFraction! - 0.6149) < 0.001);
  assert.equal(quota.groups[1]!.buckets[0]!.resetTime, "2026-12-01T20:24:02Z");
  assert.deepEqual(quota.credits, { remaining: 0, upgradeUri: "https://antigravity.google/g1-upgrade" });
  assert.equal(quota.fetchedAt, "2026-11-24T20:00:00.000Z");
});

test("una salida vacía o rara no rompe", () => {
  assert.deepEqual(parseSunsamAntigravityQuota(null).groups, []);
  assert.deepEqual(parseSunsamAntigravityQuota({ command: { data: { groups: "x" } } }).groups, []);
});

test("reconoce la URL del proveedor", () => {
  assert.equal(isSunsamAntigravityBaseUrl("agy-acp://local"), true);
  assert.equal(isSunsamAntigravityBaseUrl("https://api.z.ai"), false);
  assert.equal(isSunsamAntigravityBaseUrl(undefined), false);
});

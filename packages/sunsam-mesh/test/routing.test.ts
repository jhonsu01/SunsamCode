import assert from "node:assert/strict";
import test from "node:test";
import { calibrationReport, suggestThreshold } from "../src/domain/calibration.js";
import { extractRequestFeatures, heuristicLocalProbability } from "../src/domain/complexity.js";
import { assertSafeServerBinding, parseMeshConfig } from "../src/domain/config.js";
import { createResponseTextAccumulator } from "../src/domain/responseText.js";
import { buildDpoRecord, buildPerturbedRequest } from "../src/domain/rlcd.js";
import { decideTier, rankPeers, resolveVirtualModel } from "../src/domain/routing.js";

const tools = Array.from({ length: 20 }, (_, index) => ({
  type: "function",
  function: { name: `t${index}` },
}));
const request = (text: string) => ({
  model: "sunsam-auto",
  tools,
  messages: [
    { role: "system", content: "x".repeat(20_000) },
    { role: "user", content: text },
  ],
});

test("short simple question routes local; multi-file refactor routes swarm", () => {
  const simple = heuristicLocalProbability(
    extractRequestFeatures(request("¿Qué es un closure en JS?"), "openai"),
  );
  const complex = heuristicLocalProbability(
    extractRequestFeatures(
      request("Refactoriza la arquitectura del módulo de autenticación y migra los tests"),
      "openai",
    ),
  );
  assert.equal(decideTier(simple, 0.75), "local");
  assert.equal(decideTier(complex, 0.75), "swarm");
});

test("virtual models resolve to modes and direct peer routes", () => {
  const peers = new Set(["gpu"]);
  assert.deepEqual(resolveVirtualModel("sunsam-local", peers), { kind: "tier", tier: "local" });
  assert.deepEqual(resolveVirtualModel("gpu/qwen-32b", peers), {
    kind: "direct",
    peerId: "gpu",
    model: "qwen-32b",
  });
  assert.deepEqual(resolveVirtualModel("other/model", peers), { kind: "auto" });
});

test("rankPeers prefers the requested tier, then falls back to the other tier", () => {
  const config = parseMeshConfig({
    peers: [
      { id: "slow-local", baseUrl: "http://a", tier: "local" },
      { id: "fast-local", baseUrl: "http://b", tier: "local" },
      { id: "big", baseUrl: "http://c", tier: "swarm" },
      { id: "anthropic-only", baseUrl: "http://d", tier: "local", apiFormats: ["anthropic"] },
    ],
  });
  const views = config.peers.map((peer) => ({
    config: peer,
    healthy: true,
    inflight: 0,
    ttftMs: peer.id === "slow-local" ? 3000 : 200,
    bytesPerSecond: peer.id === "slow-local" ? 100 : 4000,
  }));
  const ranked = rankPeers(views, {
    tier: "local",
    format: "openai",
    weights: config.routing.weights,
    defaultBpb: 1,
    allowMesh: true,
  });
  assert.deepEqual(
    ranked.map((peer) => peer.config.id),
    ["fast-local", "slow-local", "big"],
  );
});

test("config validation rejects unsafe bindings and bad values", () => {
  assert.throws(
    () => assertSafeServerBinding(parseMeshConfig({ server: { host: "0.0.0.0" } })),
    /apiKey/,
  );
  assert.throws(() => parseMeshConfig({ router: { threshold: 2 } }), /threshold/);
  assert.throws(() => parseMeshConfig({ peers: [{ baseUrl: "ftp://x" }] }), /http/);
  assert.doesNotThrow(() =>
    assertSafeServerBinding(parseMeshConfig({ server: { host: "0.0.0.0", apiKey: "k" } })),
  );
});

test("response accumulator reads OpenAI SSE, Anthropic SSE and plain JSON", () => {
  const openai = createResponseTextAccumulator("openai");
  openai.push('data: {"choices":[{"delta":{"content":"Hola"}}]}\n\ndata: {"choices":[{"del');
  openai.push('ta":{"content":" mundo"}}]}\n\ndata: [DONE]\n');
  openai.finish();
  assert.equal(openai.text, "Hola mundo");

  const anthropic = createResponseTextAccumulator("anthropic");
  anthropic.push(
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n',
  );
  anthropic.push('data: {"type":"content_block_start","content_block":{"type":"tool_use"}}\n');
  anthropic.finish();
  assert.equal(anthropic.text, "ok");
  assert.equal(anthropic.usedTools, true);

  const json = createResponseTextAccumulator("openai");
  json.push('{"choices":[{"message":{"content":"plain"}}]}');
  json.finish();
  assert.equal(json.text, "plain");
});

test("RLCD requests perturb the system prompt and DPO records skip empty pairs", () => {
  const perturbed = buildPerturbedRequest(
    { messages: [{ role: "user", content: "hi" }], stream: true },
    "openai",
    "NEG",
    "m",
  );
  assert.equal(perturbed.stream, false);
  assert.deepEqual((perturbed.messages as Array<{ role: string }>)[0], {
    role: "system",
    content: "NEG",
  });
  const anthropic = buildPerturbedRequest(
    { system: "base", messages: [] },
    "anthropic",
    "POS",
    "m",
  );
  assert.equal(anthropic.system, "base\n\nPOS");
  assert.equal(buildDpoRecord([{ role: "user", text: "q" }], "same", "same", {}), null);
  assert.ok(buildDpoRecord([{ role: "user", text: "q" }], "good", "bad", {}));
});

test("calibration metrics and threshold suggestion", () => {
  const decisions = Array.from({ length: 40 }, (_, index) => ({
    pLocal: index / 40,
    localSufficient: index >= 20,
  }));
  const report = calibrationReport(decisions);
  assert.equal(report.count, 40);
  assert.ok(report.brier! > 0 && report.brier! < 0.25);
  // Con precisión objetivo 1.0 el umbral es exactamente el primer p con acierto garantizado (0.5);
  // con 0.95 se tolera un fallo y el umbral baja al siguiente escalón.
  assert.equal(suggestThreshold(decisions, 1, 10), 0.5);
  assert.equal(suggestThreshold(decisions, 0.95, 10), 0.475);
  assert.equal(suggestThreshold(decisions.slice(0, 5), 0.9, 20), null);
  assert.equal(calibrationReport([]).brier, null);
});

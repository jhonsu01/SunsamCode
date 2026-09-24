import assert from "node:assert/strict";
import test from "node:test";
import {
  EOT_BYTE,
  endOfTokenByteDistributions,
  firstByteLabelDistribution,
  marginalizeItByteDistributions,
  tokenBytes,
} from "../src/domain/byteLogits.js";
import { bitsPerByte, bytesPerSecond, bytesPerToken } from "../src/domain/bitsPerByte.js";
import { buildByteDistillTokens, readRouteJudgeSoftLabel } from "../src/domain/teacherSignals.js";

const bytes = (text: string) => tokenBytes(text);
const probOf = (dist: ReadonlyArray<readonly [number, number]>, symbol: string | number) =>
  dist.find(
    ([byte]) => byte === (typeof symbol === "number" ? symbol : symbol.charCodeAt(0)),
  )?.[1] ?? 0;

// Ejemplo "Tiramisu" del paper (Figura 2): tras "Tiram" el teacher predice el token siguiente.
const tiramisu = [
  { bytes: bytes("isu"), logprob: Math.log(0.5) },
  { bytes: bytes("isk"), logprob: Math.log(0.125) },
  { bytes: bytes("is"), logprob: Math.log(0.125) },
  { bytes: bytes("x"), logprob: Math.log(0.25) },
];

test("End-Of-Token reproduces the paper example exactly", () => {
  const positions = endOfTokenByteDistributions(tiramisu, bytes("isu"));
  assert.equal(positions.length, 4);
  assert.equal(positions.at(-1)!.target, EOT_BYTE);
  // B1: masa total de tokens que empiezan por "i" frente a "x".
  assert.ok(Math.abs(probOf(positions[0]!.dist, "i") - 0.75) < 1e-9);
  // B3 tras el prefijo "is": P(u)=0.5/0.75, P(k)=0.125/0.75, P(<eot>)=0.125/0.75.
  const b3 = positions[2]!.dist;
  assert.ok(Math.abs(probOf(b3, "u") - 0.6667) < 1e-4);
  assert.ok(Math.abs(probOf(b3, "k") - 0.1667) < 1e-4);
  assert.ok(Math.abs(probOf(b3, EOT_BYTE) - 0.1667) < 1e-4);
  assert.ok(
    positions.every(
      (position) => Math.abs(position.dist.reduce((sum, [, p]) => sum + p, 0) - 1) < 1e-9,
    ),
  );
});

test("Marginalize-It drops the mass of tokens ending at the prefix", () => {
  const positions = marginalizeItByteDistributions(tiramisu, bytes("isu"));
  assert.equal(positions.length, 3);
  const b3 = positions[2]!.dist;
  assert.ok(Math.abs(probOf(b3, "u") - 0.8) < 1e-9);
  assert.ok(Math.abs(probOf(b3, "k") - 0.2) < 1e-9);
  assert.equal(probOf(b3, EOT_BYTE), 0);
  assert.ok(positions[2]!.coverage < positions[0]!.coverage);
});

test("the target token is added when top-k does not include it", () => {
  const positions = endOfTokenByteDistributions(
    [{ bytes: bytes("a"), logprob: Math.log(0.9) }],
    bytes("b"),
    Math.log(0.05),
  );
  assert.ok(probOf(positions[0]!.dist, "b") > 0);
});

test("first-byte label distribution is tokenizer independent", () => {
  const distribution = firstByteLabelDistribution(
    [
      { bytes: bytes("A"), logprob: Math.log(0.6) },
      { bytes: bytes(" A"), logprob: Math.log(0.1) },
      { bytes: bytes("B"), logprob: Math.log(0.2) },
      { bytes: bytes("Because"), logprob: Math.log(0.1) },
    ],
    ["A", "B"],
  );
  assert.ok(Math.abs(distribution.A! - 0.7) < 1e-9);
  assert.ok(Math.abs(distribution.B! - 0.3) < 1e-9);
  assert.throws(() => firstByteLabelDistribution([], ["local", "large"]));
});

test("bits-per-byte and byte throughput", () => {
  const tokens = [
    { logprob: Math.log(0.5), byteLength: 4 },
    { logprob: Math.log(0.25), byteLength: 4 },
  ];
  assert.ok(Math.abs(bitsPerByte(tokens)! - 3 / 8) < 1e-12);
  assert.equal(bitsPerByte([]), null);
  assert.equal(bytesPerToken(tokens), 4);
  assert.equal(bytesPerSecond(500, 250), 2000);
  assert.equal(bytesPerSecond(0, 10), null);
});

test("OpenAI logprobs become byte-level distillation records and judge soft labels", () => {
  const response = {
    choices: [
      {
        logprobs: {
          content: [
            {
              token: "A",
              logprob: Math.log(0.8),
              bytes: [65],
              top_logprobs: [
                { token: "A", logprob: Math.log(0.8), bytes: [65] },
                { token: "B", logprob: Math.log(0.2), bytes: [66] },
              ],
            },
          ],
        },
      },
    ],
  };
  const tokens = buildByteDistillTokens(response.choices[0]!.logprobs.content, "end-of-token");
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0]!.positions.length, 2);
  const label = readRouteJudgeSoftLabel(response);
  assert.ok(label && Math.abs(label.local - 0.8) < 1e-9 && Math.abs(label.swarm - 0.2) < 1e-9);
});

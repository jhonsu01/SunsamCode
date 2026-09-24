import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { DatasetName, DatasetSink, MeshLogger } from "../src/app/ports.js";
import { parseMeshConfig } from "../src/domain/config.js";
import { startMesh, type MeshHandle } from "../src/adapters/startMesh.js";

const silent: MeshLogger = { debug() {}, info() {}, warn() {}, error() {} };

class MemorySink implements DatasetSink {
  readonly records: Array<{ dataset: DatasetName; record: unknown }> = [];
  async append(dataset: DatasetName, record: unknown): Promise<void> {
    this.records.push({ dataset, record });
  }
  of(dataset: DatasetName) {
    return this.records
      .filter((entry) => entry.dataset === dataset)
      .map((entry) => entry.record as Record<string, unknown>);
  }
}

/** Upstream OpenAI-compatible falso: SSE si `stream`, JSON si no; logprobs para el juez. */
async function fakePeer(name: string): Promise<{ url: string; server: Server; hits: string[] }> {
  const hits: string[] = [];
  const server = createServer(async (request, response) => {
    if (request.url?.endsWith("/models")) {
      response.writeHead(200, { "content-type": "application/json" }).end('{"data":[]}');
      return;
    }
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw) as {
      stream?: boolean;
      logprobs?: boolean;
      messages: Array<{ role: string; content: string }>;
    };
    hits.push(`${request.headers["x-sunsam-hops"]}:${body.stream ? "stream" : "json"}`);
    const system = body.messages.find((message) => message.role === "system")?.content ?? "";
    const text = system.includes("vaga")
      ? `${name}: respuesta vaga`
      : `${name}: respuesta completa`;
    if (body.logprobs) {
      const top = [
        { token: "A", logprob: Math.log(0.7), bytes: [65] },
        { token: "B", logprob: Math.log(0.3), bytes: [66] },
      ];
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [
            {
              message: { content: "A" },
              logprobs: { content: [{ ...top[0], top_logprobs: top }] },
            },
          ],
        }),
      );
      return;
    }
    if (!body.stream) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { content: text } }] }));
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream" });
    for (const part of text.split(" ")) {
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: `${part} ` } }] })}\n\n`,
      );
    }
    response.end("data: [DONE]\n\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server, hits };
}

async function closedPortUrl(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://127.0.0.1:${port}`;
}

/** Texto concatenado de un stream SSE OpenAI. */
const sseText = (raw: string) =>
  raw
    .split("\n")
    .filter((line) => line.startsWith("data: ") && !line.includes("[DONE]"))
    .map(
      (line) =>
        (JSON.parse(line.slice(6)) as { choices: Array<{ delta: { content: string } }> })
          .choices[0]!.delta.content,
    )
    .join("");

const chat = (text: string, extra: Record<string, unknown> = {}) => ({
  model: "sunsam-auto",
  stream: true,
  messages: [{ role: "user", content: text }],
  ...extra,
});

test("Sunsam Mesh gateway: routing, fallback, sticky, auth, feedback and RLCD", async (t) => {
  const local = await fakePeer("local");
  const swarm = await fakePeer("swarm");
  const sink = new MemorySink();
  const config = parseMeshConfig({
    server: { host: "127.0.0.1", port: 0, apiKey: "secret-key" },
    peers: [
      { id: "local-down", baseUrl: await closedPortUrl(), tier: "local", models: ["tiny"] },
      { id: "local-up", baseUrl: `${local.url}/v1`, tier: "local", models: ["tiny"] },
      { id: "swarm", baseUrl: swarm.url, tier: "swarm", models: ["big"] },
    ],
    // A igual coste, el ranking desempata por id: "local-down" va primero y fuerza el fallback.
    feedback: {
      rlcd: { enabled: true, sampleRate: 1 },
      layaSoftLabels: { enabled: true, sampleRate: 1 },
    },
  });
  const mesh: MeshHandle = await startMesh(config, silent, {
    sink,
    random: () => 0,
    disableHealthLoop: true,
  });
  const base = `http://127.0.0.1:${mesh.port}`;
  const auth = { authorization: "Bearer secret-key", "content-type": "application/json" };
  t.after(async () => {
    await mesh.close();
    local.server.close();
    swarm.server.close();
  });

  await t.test("rejects requests without the API key", async () => {
    const response = await fetch(`${base}/v1/models`);
    assert.equal(response.status, 401);
  });

  await t.test("lists virtual and direct models", async () => {
    const response = await fetch(`${base}/v1/models`, { headers: auth });
    const ids = ((await response.json()) as { data: Array<{ id: string }> }).data.map(
      (model) => model.id,
    );
    assert.deepEqual(ids.slice(0, 3), ["sunsam-auto", "sunsam-local", "sunsam-swarm"]);
    assert.ok(ids.includes("swarm/big"));
  });

  let simpleDecision = "";
  await t.test("simple question goes local, falling back past the dead local peer", async () => {
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify(chat("¿Qué es un closure?")),
    });
    const text = sseText(await response.text());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-sunsam-route"), "local");
    assert.equal(response.headers.get("x-sunsam-peer"), "local-up");
    assert.match(text, /local: respuesta completa/);
    simpleDecision = response.headers.get("x-sunsam-decision-id")!;
    const dead = mesh.registry.status().find((peer) => peer.config.id === "local-down");
    assert.equal(dead?.healthy, false);
  });

  await t.test("tool continuation of the same conversation keeps its tier (sticky)", async () => {
    const body = chat("¿Qué es un closure?", {
      messages: [
        { role: "user", content: "¿Qué es un closure?" },
        {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "1", type: "function", function: { name: "x", arguments: "{}" } }],
        },
        { role: "tool", tool_call_id: "1", content: "resultado largo ".repeat(500) },
      ],
    });
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify(body),
    });
    await response.text();
    assert.equal(response.headers.get("x-sunsam-route"), "local");
    assert.equal(response.headers.get("x-sunsam-classifier"), "sticky");
  });

  await t.test(
    "complex task goes to the swarm and produces an RLCD pair and a Laya soft label",
    async () => {
      const response = await fetch(`${base}/v1/chat/completions`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify(
          chat(
            "Refactoriza la arquitectura del módulo de pagos, migra los tests y optimiza el rendimiento",
          ),
        ),
      });
      assert.match(sseText(await response.text()), /swarm: respuesta completa/);
      assert.equal(response.headers.get("x-sunsam-route"), "swarm");
      await mesh.jobs.idle();
      const [pair] = sink.of("rlcd-pairs");
      assert.ok(pair, "se esperaba un par RLCD");
      assert.match(JSON.stringify(pair.chosen), /respuesta completa/);
      assert.match(JSON.stringify(pair.rejected), /respuesta vaga/);
      const labels = sink.of("laya-soft-labels");
      assert.ok(labels.length >= 1);
      const route = (labels[0]!.soft_labels as { route: { local: number } }).route;
      assert.ok(Math.abs(route.local - 0.7) < 1e-9);
    },
  );

  await t.test("feedback is joined with the decision and feeds calibration", async () => {
    const response = await fetch(`${base}/sunsam/feedback`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ decisionId: simpleDecision, localSufficient: true }),
    });
    assert.deepEqual(await response.json(), { accepted: true });
    const status = (await (await fetch(`${base}/sunsam/status`, { headers: auth })).json()) as {
      calibration: { count: number };
    };
    assert.equal(status.calibration.count, 1);
    assert.ok(sink.of("decisions").length >= 3);
  });

  await t.test("anthropic requests with no anthropic-capable peer return 503", async () => {
    const response = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        model: "sunsam-auto",
        max_tokens: 10,
        messages: [{ role: "user", content: "hola" }],
      }),
    });
    assert.equal(response.status, 503);
    assert.equal(
      ((await response.json()) as { error: { type: string } }).error.type,
      "sunsam_no_peer",
    );
  });

  await t.test("hops header is incremented towards peers", () => {
    assert.ok(local.hits.every((hit) => hit.startsWith("1:")));
  });
});

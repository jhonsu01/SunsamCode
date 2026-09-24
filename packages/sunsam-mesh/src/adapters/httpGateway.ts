/**
 * Gateway HTTP sin estado: traduce HTTP ⇄ MeshRouter. Expone la API OpenAI/Anthropic que la app
 * consume como Custom provider, más endpoints de estado y feedback.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { timingSafeEqual } from "node:crypto";
import type { MeshRouter } from "../app/meshRouter.js";
import type { PeerRegistry } from "../app/peerRegistry.js";
import type { FeedbackJobs } from "../app/feedbackJobs.js";
import type { MeshLogger } from "../app/ports.js";
import type { ApiFormat } from "../domain/requestShape.js";
import { HOPS_HEADER } from "./httpPeerTransport.js";

const MAX_BODY_BYTES = 32 * 1024 * 1024;
const FORWARDED_CLIENT_HEADERS = ["anthropic-version", "anthropic-beta"];

interface GatewayDeps {
  router: MeshRouter;
  registry: PeerRegistry;
  jobs: FeedbackJobs | null;
  logger: MeshLogger;
  /** Claves aceptadas (server.apiKey y/o token de la mesh). Vacío = sin autenticación. */
  acceptedKeys: string[];
  nodeId: string;
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES)
      throw Object.assign(new Error("body demasiado grande"), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw Object.assign(new Error("JSON inválido"), { status: 400 });
  }
}

function presentedKey(request: IncomingMessage): string | undefined {
  const bearer = request.headers.authorization?.match(/^Bearer\s+(.+)$/iu)?.[1];
  const apiKey = request.headers["x-api-key"];
  return bearer ?? (typeof apiKey === "string" ? apiKey : undefined);
}

function keyMatches(presented: string | undefined, accepted: readonly string[]): boolean {
  if (accepted.length === 0) return true;
  if (!presented) return false;
  const given = Buffer.from(presented);
  return accepted.some((key) => {
    const expected = Buffer.from(key);
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}

function formatForPath(path: string): ApiFormat | null {
  if (path === "/v1/chat/completions" || path === "/chat/completions") return "openai";
  if (path === "/v1/messages" || path === "/messages") return "anthropic";
  return null;
}

export function createGatewayServer(deps: GatewayDeps): Server {
  return createServer((request, response) => {
    void handle(deps, request, response).catch((error: unknown) => {
      const status = (error as { status?: number }).status ?? 500;
      deps.logger.error("error en gateway", {
        error: error instanceof Error ? error.message : String(error),
      });
      if (!response.headersSent)
        sendJson(response, status, {
          error: {
            type: "sunsam_gateway_error",
            message: String((error as Error).message ?? error),
          },
        });
      else response.destroy();
    });
  });
}

async function handle(
  deps: GatewayDeps,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const path = url.pathname.replace(/\/+$/u, "") || "/";
  if (path === "/health") return sendJson(response, 200, { ok: true, nodeId: deps.nodeId });
  if (!keyMatches(presentedKey(request), deps.acceptedKeys)) {
    return sendJson(response, 401, {
      error: { type: "authentication_error", message: "API key inválida" },
    });
  }

  if (request.method === "GET" && (path === "/v1/models" || path === "/models")) {
    const data = deps.router
      .listModels()
      .map((id) => ({ id, object: "model", owned_by: "sunsam-mesh" }));
    return sendJson(response, 200, { object: "list", data });
  }
  if (request.method === "GET" && path === "/sunsam/status") {
    return sendJson(response, 200, {
      nodeId: deps.nodeId,
      peers: deps.registry.status(),
      calibration: deps.router.calibration(),
      feedbackQueue: deps.jobs?.pending() ?? 0,
    });
  }
  if (request.method === "POST" && path === "/sunsam/feedback") {
    const body = (await readBody(request)) as { decisionId?: unknown; localSufficient?: unknown };
    if (typeof body.decisionId !== "string" || typeof body.localSufficient !== "boolean") {
      return sendJson(response, 400, {
        error: { message: "se esperan decisionId (string) y localSufficient (boolean)" },
      });
    }
    const accepted = await deps.router.recordFeedback(body.decisionId, body.localSufficient);
    return sendJson(response, accepted ? 200 : 404, { accepted });
  }

  const format = request.method === "POST" ? formatForPath(path) : null;
  if (!format)
    return sendJson(response, 404, {
      error: { type: "not_found", message: `${request.method} ${path}` },
    });

  const body = await readBody(request);
  const hops = Number.parseInt(String(request.headers[HOPS_HEADER] ?? "0"), 10) || 0;
  const headers = Object.fromEntries(
    FORWARDED_CLIENT_HEADERS.flatMap((name) => {
      const value = request.headers[name];
      return typeof value === "string" ? [[name, value]] : [];
    }),
  );
  const abort = new AbortController();
  response.on("close", () => {
    if (!response.writableFinished) abort.abort();
  });

  const routed = await deps.router.route({ format, body, hops, headers, signal: abort.signal });
  response.writeHead(routed.status, {
    ...routed.headers,
    "x-sunsam-route": routed.decision.tier,
    "x-sunsam-peer": routed.decision.peerId ?? "",
    "x-sunsam-decision-id": routed.decision.id,
    "x-sunsam-p-local": routed.decision.pLocal === null ? "" : routed.decision.pLocal.toFixed(4),
    "x-sunsam-classifier": routed.decision.classifier,
  });
  if (!routed.body) {
    response.end();
    return;
  }
  const nodeStream = Readable.fromWeb(routed.body as Parameters<typeof Readable.fromWeb>[0]);
  nodeStream.on("error", () => response.destroy());
  nodeStream.pipe(response);
}

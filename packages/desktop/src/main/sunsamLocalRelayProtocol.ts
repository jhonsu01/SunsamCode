/**
 * Sunsam: relay local con el protocolo Relay V2 de upstream (3.17), para emparejar el teléfono con
 * la app sin servidores externos. Lo sirve sunsamLocalRemoteRelay.ts.
 *
 * En el relay de Z.ai las peticiones llevan el JWT de la cuenta (teléfono y equipo con la misma
 * cuenta). Aquí hay un único usuario local y su "JWT" es un secreto aleatorio guardado en el equipo:
 * el escritorio lo usa directamente y el teléfono lo recibe en el fragmento `#k=` del QR. Con él se
 * piden los tokens de un solo uso para `/api/v1/remote/ws2`, igual que contra Z.ai.
 *
 * La lógica sigue el relay de referencia de upstream (packages/shared/test/fixtures/fake-relay-v2.ts)
 * y valida con los mismos parsers de @zcode/shared/web-remote-relay.
 */
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import {
  parseWebRemoteControlRelayV2HttpRequest,
  parseWebRemoteControlRelayV2OutgoingMessage,
  WEB_REMOTE_CONTROL_RELAY_V2_WS_PATH,
  type WebRemoteControlRelayV2IncomingMessage,
  type WebRemoteControlRelayV2Meta,
  type WebRemoteControlRelayV2Role,
} from "@zcode/shared/web-remote-relay";

export const SUNSAM_LOCAL_USER_ID = "sunsam-local";
const API_PREFIX = "/api/v1/remote/";
/** Igual que el relay de Z.ai: mensajes de hasta 1 MiB y tokens de 60 segundos. */
const MAX_MESSAGE_BYTES = 1_048_576;
const TOKEN_TTL_MS = 60_000;
const MAX_BODY_BYTES = 64 * 1024;

export interface SunsamRelayDeviceRecord {
  device_mid: string;
  created_at: number;
}

interface Connection {
  socket: WebSocket;
  role: WebRemoteControlRelayV2Role;
  deviceSid?: string;
  terminalSid: string;
  meta: WebRemoteControlRelayV2Meta;
}

export interface SunsamLocalRelayV2Options {
  /** Secreto local que hace de JWT del único usuario. */
  secret: string;
  devices?: Record<string, SunsamRelayDeviceRecord>;
  persist?: (devices: Record<string, SunsamRelayDeviceRecord>) => void;
  now?: () => number;
}

function secretMatches(expected: string, received: string | undefined): boolean {
  if (!received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("body too large");
    chunks.push(Buffer.from(chunk as Buffer));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class SunsamLocalRelayV2 {
  private readonly devices = new Map<string, SunsamRelayDeviceRecord>();
  private readonly tokens = new Map<
    string,
    { role: WebRemoteControlRelayV2Role; expiresAt: number }
  >();
  private readonly owners = new Map<
    string,
    Partial<Record<WebRemoteControlRelayV2Role, Connection>>
  >();
  private readonly wsServer = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
  });
  private readonly now: () => number;

  constructor(private readonly options: SunsamLocalRelayV2Options) {
    this.now = options.now ?? Date.now;
    for (const [sid, record] of Object.entries(options.devices ?? {})) {
      if (record && typeof record.device_mid === "string") this.devices.set(sid, record);
    }
  }

  /** true si la petición era del API del relay (y ya se respondió). */
  async handleHttp(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const path = new URL(request.url ?? "/", "http://local").pathname;
    if (!path.startsWith(API_PREFIX)) return false;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    const reply = (
      status: number,
      data?: unknown,
      code = status === 200 ? 0 : status,
      msg = "",
    ) => {
      response.writeHead(status);
      response.end(JSON.stringify({ code, msg, ...(data === undefined ? {} : { data }) }));
    };
    const jwt = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!secretMatches(this.options.secret, jwt)) {
      reply(401);
      return true;
    }
    let body: unknown;
    try {
      body = request.method === "GET" ? {} : await readJsonBody(request);
    } catch {
      reply(413);
      return true;
    }
    if (path === "/api/v1/remote/token" && request.method === "POST") {
      const parsed = parseWebRemoteControlRelayV2HttpRequest("token", body);
      if (!parsed) return (reply(400, undefined, 3001, "parameter error"), true);
      this.pruneTokens();
      const token = randomBytes(16).toString("base64url");
      this.tokens.set(token, { role: parsed.role, expiresAt: this.now() + TOKEN_TTL_MS });
      reply(200, { token, expires_in: TOKEN_TTL_MS / 1000 });
      return true;
    }
    if (path === "/api/v1/remote/device" && request.method === "POST") {
      const parsed = parseWebRemoteControlRelayV2HttpRequest("register", body);
      if (!parsed) return (reply(400, undefined, 3001, "parameter error"), true);
      const sid = `d_${randomUUID()}`;
      const record = { device_mid: parsed.device_mid, created_at: Math.floor(this.now() / 1000) };
      this.devices.set(sid, record);
      this.save();
      reply(200, { device_sid: sid, ...record, online: false, meta: {} });
      return true;
    }
    if (path === "/api/v1/remote/device" && request.method === "GET") {
      reply(
        200,
        [...this.devices.entries()].map(([sid, record]) => {
          const device = this.owners.get(sid)?.device;
          return { device_sid: sid, ...record, online: !!device, meta: device?.meta ?? {} };
        }),
      );
      return true;
    }
    if (path === "/api/v1/remote/device/delete" && request.method === "POST") {
      const parsed = parseWebRemoteControlRelayV2HttpRequest("delete", body);
      if (!parsed) return (reply(400, undefined, 3001, "parameter error"), true);
      if (this.owners.get(parsed.device_sid)?.device) {
        return (reply(400, undefined, 3005, "wrong status"), true);
      }
      if (this.devices.delete(parsed.device_sid)) this.save();
      reply(200);
      return true;
    }
    // Las notificaciones push al móvil necesitan un servicio externo: se informan como no disponibles.
    reply(404);
    return true;
  }

  /** true si era el WebSocket del relay (aceptado o rechazado). */
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    const url = new URL(request.url ?? "/", "http://local");
    if (url.pathname !== WEB_REMOTE_CONTROL_RELAY_V2_WS_PATH) return false;
    const token = url.searchParams.get("token") ?? "";
    const identity = this.tokens.get(token);
    if (!identity || identity.expiresAt <= this.now()) {
      socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      return true;
    }
    // Un solo uso: se consume antes del upgrade y no se recupera si falla.
    this.tokens.delete(token);
    this.wsServer.handleUpgrade(request, socket, head, (ws) => this.attach(ws, identity.role));
    return true;
  }

  close(): void {
    for (const roles of this.owners.values()) {
      roles.device?.socket.terminate();
      roles.terminal?.socket.terminate();
    }
    this.wsServer.close();
  }

  private attach(ws: WebSocket, role: WebRemoteControlRelayV2Role): void {
    const connection: Connection = {
      socket: ws,
      role,
      terminalSid: role === "terminal" ? `t_${randomUUID()}` : "",
      meta: {},
    };
    ws.on("error", () => ws.terminate());
    ws.on("message", (data, isBinary) => this.onMessage(connection, data.toString(), isBinary));
    ws.on("close", () => this.onClose(connection));
  }

  private onMessage(connection: Connection, text: string, isBinary: boolean): void {
    const ws = connection.socket;
    if (ws.readyState !== WebSocket.OPEN) return;
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      message = text;
    }
    const parsed = isBinary ? null : parseWebRemoteControlRelayV2OutgoingMessage(message);
    if (!parsed) {
      this.send(connection, { type: "error", code: "WRONG_PARAM" });
      ws.close();
      return;
    }
    if (parsed.type === "auth_init") {
      if (connection.deviceSid || !this.devices.has(parsed.device_sid)) {
        this.send(connection, {
          type: "error",
          code: connection.deviceSid ? "WRONG_PARAM" : "AUTH_FAILED",
        });
        ws.close();
        return;
      }
      connection.deviceSid = parsed.device_sid;
      connection.meta = parsed.meta ?? {};
      const roles = this.owners.get(parsed.device_sid) ?? {};
      const old = roles[connection.role];
      roles[connection.role] = connection;
      this.owners.set(parsed.device_sid, roles);
      if (old) {
        // Un enlace, un teléfono (y un escritorio): la conexión nueva sustituye a la anterior.
        this.send(old, { type: "error", code: "KICKED" });
        old.socket.close();
      }
      const other = this.peer(connection);
      const pair_status = other ? "matched" : "waiting";
      if (other) this.send(other, { type: "pair_status_ack", pair_status, terminal_sid: "" });
      this.send(connection, {
        type: "auth_ack",
        device_sid: parsed.device_sid,
        terminal_sid: connection.terminalSid,
        pair_status,
      });
      return;
    }
    if (!connection.deviceSid) {
      this.send(connection, { type: "error", code: "AUTH_FAILED" });
      ws.close();
      return;
    }
    const other = this.peer(connection);
    if (parsed.type === "pair_status_query") {
      this.send(connection, {
        type: "pair_status_ack",
        pair_status: other ? "matched" : "waiting",
        terminal_sid: other?.terminalSid ?? "",
      });
      return;
    }
    if (other) this.send(other, { type: "data", payload: parsed.payload });
    // Igual que Z.ai: sin par, INTERNAL y la conexión sigue abierta.
    else this.send(connection, { type: "error", code: "INTERNAL" });
  }

  private onClose(connection: Connection): void {
    const roles = this.owners.get(connection.deviceSid ?? "");
    // Una conexión sustituida se cierra después de que la nueva ya es dueña: no la liberes.
    if (roles?.[connection.role] !== connection) return;
    delete roles[connection.role];
    const other = this.peer(connection);
    if (other) {
      this.send(other, { type: "pair_status_ack", pair_status: "waiting", terminal_sid: "" });
      if (connection.role === "device") {
        this.send(other, { type: "error", code: "DEVICE_OFFLINE" });
        other.socket.close();
      }
    }
    if (!roles.device && !roles.terminal) this.owners.delete(connection.deviceSid ?? "");
  }

  private peer(connection: Connection): Connection | undefined {
    return this.owners.get(connection.deviceSid ?? "")?.[
      connection.role === "device" ? "terminal" : "device"
    ];
  }

  private send(connection: Connection, message: WebRemoteControlRelayV2IncomingMessage): void {
    if (connection.socket.readyState === WebSocket.OPEN) {
      // V2: marcas de tiempo en segundos, no milisegundos.
      connection.socket.send(
        JSON.stringify({ ...message, server_ts: Math.floor(this.now() / 1000) }),
      );
    }
  }

  private pruneTokens(): void {
    const now = this.now();
    for (const [token, entry] of this.tokens) if (entry.expiresAt <= now) this.tokens.delete(token);
  }

  private save(): void {
    this.options.persist?.(Object.fromEntries(this.devices));
  }
}

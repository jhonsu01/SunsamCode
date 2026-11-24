// Sunsam: proceso `agy acp` (Google Antigravity) hablado por JSON-RPC 2.0, una línea por mensaje.
// El CLI oficial guarda la sesión de Google en el llavero del sistema; aquí nunca se tocan tokens.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export const AGY_ACP_PROTOCOL_VERSION = 1;
const CLIENT_INFO = { name: "sunsam-code", version: "1" } as const;

export interface AgyRpcError extends Error {
  readonly code?: number;
  readonly data?: unknown;
}

type ServerRequestHandler = (method: string, params: unknown) => Promise<unknown>;
type NotificationHandler = (method: string, params: unknown) => void;

/** Ruta de `agy`: variable explícita, instalación por usuario de Windows o PATH. */
export function resolveAgyPath(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.SUNSAM_AGY_PATH?.trim();
  if (explicit) return explicit;
  const localAppData = env.LOCALAPPDATA;
  if (process.platform === "win32" && localAppData) {
    const candidate = path.join(localAppData, "agy", "bin", "agy.exe");
    if (existsSync(candidate)) return candidate;
  }
  const home = env.HOME ?? env.USERPROFILE;
  if (process.platform !== "win32" && home) {
    for (const candidate of [path.join(home, ".local", "bin", "agy"), "/usr/local/bin/agy"]) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return process.platform === "win32" ? "agy.exe" : "agy";
}

function rpcError(message: string, code?: number, data?: unknown): AgyRpcError {
  const error = new Error(message) as Error & { code?: number; data?: unknown };
  error.name = "AgyRpcError";
  if (code !== undefined) error.code = code;
  if (data !== undefined) error.data = data;
  return error;
}

export class AgyProcess {
  private child?: ChildProcessWithoutNullStreams;
  private buffer = "";
  private nextId = 0;
  private readonly pending = new Map<number, { resolve(v: unknown): void; reject(e: Error): void }>();
  private exited = false;
  private stderrTail = "";
  onServerRequest: ServerRequestHandler = async (method) => {
    throw rpcError(`Method not supported by Sunsam Code: ${method}`, -32601);
  };
  onNotification: NotificationHandler = () => undefined;
  onExit: (reason: string) => void = () => undefined;

  constructor(
    private readonly agyPath: string,
    private readonly cwd: string,
  ) {}

  get alive(): boolean {
    return !!this.child && !this.exited;
  }

  start(): void {
    // Un .js/.mjs se lanza con el Node actual: lo usan las pruebas con un agy simulado.
    const script = /\.(c|m)?js$/i.test(this.agyPath);
    const child = spawn(script ? process.execPath : this.agyPath, script ? [this.agyPath, "acp"] : ["acp"], {
      cwd: existsSync(this.cwd) ? this.cwd : undefined,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: process.env,
    });
    this.child = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.onData(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-2000);
    });
    child.on("error", (error) => this.fail(this.describeSpawnError(error)));
    child.on("exit", (code) => this.fail(`agy acp terminó (código ${code ?? "?"}). ${this.stderrTail.trim()}`));
    child.stdin.on("error", () => undefined);
  }

  private describeSpawnError(error: NodeJS.ErrnoException): string {
    if (error.code === "ENOENT") {
      return `No se encontró el CLI de Antigravity («${this.agyPath}»). Instálalo o define SUNSAM_AGY_PATH.`;
    }
    return `No se pudo iniciar agy: ${error.message}`;
  }

  private fail(reason: string): void {
    if (this.exited) return;
    this.exited = true;
    for (const waiter of this.pending.values()) waiter.reject(rpcError(reason));
    this.pending.clear();
    this.onExit(reason);
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let index: number;
    while ((index = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue; // agy no escribe otra cosa en stdout; una línea rota no debe tumbar la sesión.
      }
      this.dispatch(message);
    }
  }

  private dispatch(message: Record<string, unknown>): void {
    const method = typeof message.method === "string" ? message.method : undefined;
    if (method === undefined && typeof message.id === "number") {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      const error = message.error as { message?: string; code?: number; data?: unknown } | undefined;
      if (error) waiter.reject(rpcError(error.message ?? "agy error", error.code, error.data));
      else waiter.resolve(message.result);
      return;
    }
    if (!method) return;
    if (message.id === undefined) {
      this.onNotification(method, message.params);
      return;
    }
    const id = message.id;
    this.onServerRequest(method, message.params).then(
      (result) => this.write({ jsonrpc: "2.0", id, result: result ?? {} }),
      (error: AgyRpcError) =>
        this.write({
          jsonrpc: "2.0",
          id,
          error: { code: error.code ?? -32603, message: error.message },
        }),
    );
  }

  private write(message: unknown): void {
    if (!this.alive) return;
    this.child!.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request<T>(method: string, params: unknown, timeoutMs?: number): Promise<T> {
    if (!this.alive) return Promise.reject(rpcError("agy acp no está en ejecución."));
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      this.pending.set(id, {
        resolve: (value) => {
          if (timer) clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          if (timer) clearTimeout(timer);
          reject(error);
        },
      });
      if (timeoutMs) {
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(rpcError(`agy no respondió a «${method}» en ${Math.round(timeoutMs / 1000)} s.`));
        }, timeoutMs);
      }
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method: string, params: unknown): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  async initialize(): Promise<AgyInitializeResult> {
    return this.request<AgyInitializeResult>(
      "initialize",
      {
        protocolVersion: AGY_ACP_PROTOCOL_VERSION,
        clientInfo: CLIENT_INFO,
        // Sin fs/terminal: agy usa sus propias herramientas y pide permiso para lo que escribe o ejecuta.
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      },
      30_000,
    );
  }

  dispose(): void {
    if (!this.child || this.exited) return;
    try {
      this.child.stdin.end();
    } catch {
      /* ya cerrado */
    }
    const child = this.child;
    setTimeout(() => {
      if (!this.exited) child.kill();
    }, 1500).unref?.();
  }
}

export interface AgyTier {
  readonly name?: string;
  readonly id?: string;
  readonly upgradeUri?: string;
}

export interface AgyInitializeResult {
  readonly agentInfo?: { readonly name?: string; readonly version?: string };
  readonly authMethods?: ReadonlyArray<{ readonly id: string; readonly name?: string }>;
}

export interface AgyConfigOption {
  readonly id: string;
  readonly name?: string;
  readonly category?: string;
  readonly currentValue?: string;
  readonly options?: ReadonlyArray<{ readonly value: string; readonly name?: string }>;
}

export interface AgySessionNewResult {
  readonly sessionId: string;
  readonly configOptions?: readonly AgyConfigOption[];
  readonly _meta?: { readonly antigravity?: { readonly tier?: AgyTier } };
}

export function readTier(result: unknown): AgyTier | undefined {
  const meta = (result as { _meta?: { antigravity?: { tier?: AgyTier } } } | undefined)?._meta;
  return meta?.antigravity?.tier;
}

/** Errores que significan «no hay sesión de Google»: se explican en vez de reintentar. */
export function isAgyAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /sign[- ]?in|log ?in|unauthenticated|not authenticated|credential|oauth/i.test(message);
}

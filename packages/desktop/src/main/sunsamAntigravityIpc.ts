// Sunsam: estado de la cuenta de Google en Antigravity y login, para Ajustes de modelos.
// Habla con el CLI oficial `agy acp` (JSON-RPC por stdio). Consultar el estado abre y cierra una
// sesión sin enviar mensajes: no gasta cuota ni deja conversaciones en el historial de Antigravity.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ipcMain, shell } from "electron";
import {
  SUNSAM_ANTIGRAVITY_CHANNELS,
  parseSunsamAntigravityQuota,
  type SunsamAntigravityQuota,
  type SunsamAntigravityModel,
  type SunsamAntigravityResult,
  type SunsamAntigravityStatus,
} from "@zcode/shared";

interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
}

const THOUGHT_SUFFIXES = ["low", "medium", "high", "xhigh"] as const;

export function resolveSunsamAgyPath(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicit = env.SUNSAM_AGY_PATH?.trim();
  if (explicit) return existsSync(explicit) ? explicit : undefined;
  const candidates: string[] = [];
  if (process.platform === "win32" && env.LOCALAPPDATA) {
    candidates.push(path.join(env.LOCALAPPDATA, "agy", "bin", "agy.exe"));
  }
  const home = env.HOME ?? env.USERPROFILE;
  if (home) candidates.push(path.join(home, ".local", "bin", process.platform === "win32" ? "agy.exe" : "agy"));
  candidates.push("/usr/local/bin/agy", "/opt/homebrew/bin/agy");
  for (const dir of (env.PATH ?? env.Path ?? "").split(path.delimiter)) {
    if (dir) candidates.push(path.join(dir, process.platform === "win32" ? "agy.exe" : "agy"));
  }
  return candidates.find((candidate) => existsSync(candidate));
}

/** Cliente JSON-RPC mínimo para una consulta corta. */
class AgyQuery {
  private buffer = "";
  private id = 0;
  private readonly pending = new Map<number, { resolve(v: unknown): void; reject(e: Error): void }>();
  private readonly child: ChildProcessWithoutNullStreams;

  constructor(agyPath: string) {
    this.child = spawn(agyPath, ["acp"], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, cwd: tmpdir() });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      let index: number;
      while ((index = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        if (!line) continue;
        try {
          const message = JSON.parse(line) as { id?: number; method?: string; result?: unknown; error?: { message?: string } };
          if (message.method !== undefined) {
            // Peticiones del servidor (permisos): no hay turnos aquí, se rechazan.
            if (message.id !== undefined) {
              this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "unsupported" } })}\n`);
            }
            continue;
          }
          const waiter = message.id === undefined ? undefined : this.pending.get(message.id);
          if (!waiter) continue;
          this.pending.delete(message.id!);
          if (message.error) waiter.reject(new Error(message.error.message ?? "agy error"));
          else waiter.resolve(message.result);
        } catch {
          /* línea no JSON: se ignora */
        }
      }
    });
    this.child.stderr.on("data", () => undefined);
    const failAll = (reason: string) => {
      for (const waiter of this.pending.values()) waiter.reject(new Error(reason));
      this.pending.clear();
    };
    this.child.on("error", (error) => failAll(error.message));
    this.child.on("exit", (code) => failAll(`agy acp terminó (código ${code ?? "?"})`));
  }

  request<T>(method: string, params: unknown, timeoutMs: number): Promise<T> {
    const id = ++this.id;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`agy no respondió a ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  close(): void {
    try {
      this.child.stdin.end();
    } catch {
      /* ya cerrado */
    }
    setTimeout(() => this.child.kill(), 1500).unref();
  }
}

interface ConfigOption {
  readonly id: string;
  readonly category?: string;
  readonly currentValue?: string;
  readonly options?: ReadonlyArray<{ readonly value: string; readonly name?: string }>;
}

/** Modelos y niveles: `availableModels` combina modelo y nivel en el id (`gemini-3.8-flash-high`). */
export function readAntigravityModels(session: {
  models?: { availableModels?: ReadonlyArray<{ modelId: string; name?: string }> };
  configOptions?: readonly ConfigOption[];
}): SunsamAntigravityModel[] {
  const modelOption = session.configOptions?.find((o) => o.id === "model" || o.category === "model");
  const bases = modelOption?.options ?? [];
  const available = session.models?.availableModels ?? [];
  return bases.map((base) => {
    const levels = THOUGHT_SUFFIXES.filter((suffix) =>
      available.some((model) => model.modelId === `${base.value}-${suffix}`),
    );
    return { id: base.value, name: base.name ?? base.value, thoughtLevels: levels };
  });
}

async function readStatus(): Promise<SunsamAntigravityStatus> {
  const agyPath = resolveSunsamAgyPath();
  if (!agyPath) return { installed: false, signedIn: false, models: [] };
  const query = new AgyQuery(agyPath);
  try {
    const init = await query.request<{ agentInfo?: { version?: string } }>(
      "initialize",
      { protocolVersion: 1, clientInfo: { name: "sunsam-code", version: "1" }, clientCapabilities: {} },
      20_000,
    );
    const version = init?.agentInfo?.version;
    let auth: { _meta?: { antigravity?: { tier?: SunsamAntigravityStatus["tier"] } } };
    try {
      auth = await query.request("authenticate", { methodId: "oauth-personal" }, 30_000);
    } catch (error) {
      return {
        installed: true,
        agyPath,
        version,
        signedIn: false,
        models: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
    const session = await query.request<{
      sessionId: string;
      models?: { availableModels?: Array<{ modelId: string; name?: string }> };
      configOptions?: ConfigOption[];
      _meta?: { antigravity?: { tier?: SunsamAntigravityStatus["tier"] } };
    }>("session/new", { cwd: tmpdir(), mcpServers: [] }, 30_000);
    await query.request("session/close", { sessionId: session.sessionId }, 5_000).catch(() => undefined);
    return {
      installed: true,
      agyPath,
      version,
      signedIn: true,
      tier: session._meta?.antigravity?.tier ?? auth?._meta?.antigravity?.tier,
      models: readAntigravityModels(session),
    };
  } finally {
    query.close();
  }
}

interface PendingLogin {
  readonly child: ChildProcessWithoutNullStreams;
  output: string;
  readonly timer: ReturnType<typeof setTimeout>;
}

const logins = new Map<string, PendingLogin>();

function startLogin(): Promise<{ loginId: string; url: string }> {
  const agyPath = resolveSunsamAgyPath();
  if (!agyPath) throw new Error("No se encontró el CLI de Antigravity (agy).");
  const child = spawn(agyPath, ["acp", "--login"], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, cwd: tmpdir() });
  const loginId = randomUUID();
  const pending: PendingLogin = {
    child,
    output: "",
    // El código solo vale mientras vive el proceso que creó el enlace.
    timer: setTimeout(() => cancelLogin(loginId), 10 * 60_000),
  };
  logins.set(loginId, pending);
  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      pending.output += chunk.toString("utf8");
      const url = pending.output.match(/https:\/\/\S+/)?.[0];
      if (url) {
        child.stdout.off("data", onData);
        void shell.openExternal(url);
        resolve({ loginId, url });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk: Buffer) => (pending.output += chunk.toString("utf8")));
    child.on("error", (error) => {
      cancelLogin(loginId);
      reject(error);
    });
    setTimeout(() => {
      if (!/https:\/\//.test(pending.output)) {
        cancelLogin(loginId);
        reject(new Error("agy no mostró el enlace de inicio de sesión."));
      }
    }, 20_000).unref();
  });
}

function finishLogin(loginId: string, code: string): Promise<{ account?: string }> {
  const pending = logins.get(loginId);
  if (!pending) throw new Error("El inicio de sesión caducó. Vuelve a empezar.");
  return new Promise((resolve, reject) => {
    let output = "";
    pending.child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString("utf8")));
    pending.child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString("utf8")));
    pending.child.once("exit", (exitCode) => {
      clearTimeout(pending.timer);
      logins.delete(loginId);
      if (exitCode === 0) resolve({ account: output.match(/Logged in as (\S+)/)?.[1] });
      else reject(new Error(output.trim().split("\n").pop() || `agy terminó con código ${exitCode}`));
    });
    pending.child.stdin.write(`${code.trim()}\n`);
  });
}

function cancelLogin(loginId: string): null {
  const pending = logins.get(loginId);
  if (!pending) return null;
  clearTimeout(pending.timer);
  logins.delete(loginId);
  pending.child.kill();
  return null;
}

/**
 * Ejecuta un comando de solo lectura de agy en modo no interactivo (`-p "/usage"`). agy responde
 * localmente, sin turno de modelo (0 tokens). Nunca se lanza agy sin `-p`: abriría su TUI.
 */
function runAgyReadOnlyCommand(agyPath: string, command: "/usage" | "/credits"): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(agyPath, ["-p", command, "--output-format", "json"], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      cwd: tmpdir(),
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`agy ${command} no respondió a tiempo`));
    }, 30_000);
    child.stdout.on("data", (chunk: Buffer) => (out += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (err += chunk.toString("utf8")));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
      try {
        const parsed = JSON.parse(json) as { status?: string; error?: string };
        if (parsed.status && parsed.status !== "SUCCESS") {
          reject(new Error(parsed.error ?? `agy ${command}: ${parsed.status}`));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error((err || out).trim().split("\n").pop() || `agy ${command} terminó con código ${code}`));
      }
    });
  });
}

const QUOTA_CACHE_MS = 60_000;
let quotaCache: { at: number; value: SunsamAntigravityQuota } | undefined;
let quotaInFlight: Promise<SunsamAntigravityQuota> | undefined;

async function readQuota(force: boolean): Promise<SunsamAntigravityQuota> {
  if (!force && quotaCache && Date.now() - quotaCache.at < QUOTA_CACHE_MS) return quotaCache.value;
  if (quotaInFlight) return quotaInFlight;
  const agyPath = resolveSunsamAgyPath();
  if (!agyPath) throw new Error("No se encontró el CLI de Antigravity (agy).");
  quotaInFlight = (async () => {
    const [usage, credits] = await Promise.all([
      runAgyReadOnlyCommand(agyPath, "/usage"),
      runAgyReadOnlyCommand(agyPath, "/credits").catch(() => undefined),
    ]);
    const value = parseSunsamAntigravityQuota(usage, credits);
    quotaCache = { at: Date.now(), value };
    return value;
  })().finally(() => {
    quotaInFlight = undefined;
  });
  return quotaInFlight;
}

async function wrap<T>(run: () => Promise<T> | T, logger: Logger): Promise<SunsamAntigravityResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[sunsam-antigravity] ${message}`);
    return { ok: false, error: message };
  }
}

export function registerSunsamAntigravityIpcHandlers(logger: Logger): void {
  ipcMain.handle(SUNSAM_ANTIGRAVITY_CHANNELS.status, () => wrap(readStatus, logger));
  ipcMain.handle(SUNSAM_ANTIGRAVITY_CHANNELS.loginStart, () => wrap(startLogin, logger));
  ipcMain.handle(SUNSAM_ANTIGRAVITY_CHANNELS.loginFinish, (_event, loginId: string, code: string) =>
    wrap(() => finishLogin(loginId, code), logger),
  );
  ipcMain.handle(SUNSAM_ANTIGRAVITY_CHANNELS.loginCancel, (_event, loginId: string) =>
    wrap(() => cancelLogin(loginId), logger),
  );
  ipcMain.handle(SUNSAM_ANTIGRAVITY_CHANNELS.quota, (_event, force?: boolean) =>
    wrap(() => readQuota(force === true), logger),
  );
}

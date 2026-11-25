// Sunsam: traduce los servidores MCP de Sunsam al formato `mcpServers` de ACP para que el
// modelo de Google (agy) pueda usarlos. agy carga además sus propios plugins
// (~/.gemini/config/plugins); los que ya tiene no se repiten para no duplicar herramientas.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { McpServerConfig } from "@zcode/contracts";

interface AcpNameValue {
  readonly name: string;
  readonly value: string;
}

export type AcpMcpServer =
  | {
      readonly name: string;
      readonly command: string;
      readonly args: string[];
      readonly env: AcpNameValue[];
    }
  | {
      readonly type: "http" | "sse";
      readonly name: string;
      readonly url: string;
      readonly headers: AcpNameValue[];
    };

/** Nombre base comparable: «GridCraft-MCP-Server», «gridcraft_mcp» y «gridcraft» dan «gridcraft». */
export function mcpStem(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_.]+/g, "-")
    .replace(/(^|-)(mcp-server|mcp|server|bridge)(?=-|$)/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Nombres de servidor válidos para agy: sin espacios ni símbolos. */
function acpName(name: string, used: Set<string>): string {
  const base = name.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "mcp";
  let candidate = base;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base}_${n}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

function pairs(record: Readonly<Record<string, string>> | undefined): AcpNameValue[] {
  return Object.entries(record ?? {}).map(([name, value]) => ({ name, value: String(value) }));
}

/** Plugins con MCP que agy ya carga por su cuenta (instalados y no desactivados). */
export function readAgyPluginMcpStems(home: string = homedir()): Set<string> {
  const stems = new Set<string>();
  const root = join(home, ".gemini", "config");
  const pluginsDir = join(root, "plugins");
  if (!existsSync(pluginsDir)) return stems;
  let disabled = new Set<string>();
  try {
    const config = JSON.parse(readFileSync(join(root, "config.json"), "utf8")) as {
      plugins?: Record<string, { enabled?: boolean }>;
    };
    disabled = new Set(
      Object.entries(config.plugins ?? {})
        .filter(([, entry]) => entry?.enabled === false)
        .map(([name]) => name),
    );
  } catch {
    // Sin config.json agy usa los plugins instalados tal cual.
  }
  for (const entry of readdirSync(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || disabled.has(entry.name)) continue;
    const file = join(pluginsDir, entry.name, "mcp_config.json");
    if (!existsSync(file)) continue;
    stems.add(mcpStem(entry.name));
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as { mcpServers?: Record<string, unknown> };
      for (const key of Object.keys(parsed.mcpServers ?? {})) stems.add(mcpStem(key));
    } catch {
      // Un mcp_config.json roto no impide usar el resto.
    }
  }
  stems.delete("");
  return stems;
}

export interface SunsamMcpForAgy {
  readonly servers: AcpMcpServer[];
  /** Servidores omitidos y por qué, para el registro. */
  readonly skipped: ReadonlyArray<{ readonly name: string; readonly reason: string }>;
}

/**
 * Elige qué servidores de Sunsam pasan a agy. Quedan fuera los desactivados, los del
 * proyecto (requieren la confianza que concede Sunsam), los integrados del propio host,
 * los que usan credenciales oficiales u OAuth (solo Sunsam sabe inyectarlas), el puente
 * MCP de Antigravity (sería agy dentro de agy) y los que agy ya tiene como plugin.
 */
export function toAcpMcpServers(
  servers: Readonly<Record<string, McpServerConfig>> | undefined,
  agyPluginStems: ReadonlySet<string> = new Set(),
): SunsamMcpForAgy {
  const result: AcpMcpServer[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const used = new Set<string>();
  for (const [name, config] of Object.entries(servers ?? {})) {
    const skip = (reason: string) => skipped.push({ name, reason });
    if (!config || config.enabled === false) {
      skip("disabled");
      continue;
    }
    const kind = config.source?.kind;
    if (kind === "workspace") {
      skip("workspace");
      continue;
    }
    if (kind === "builtin" || name === "node_repl") {
      skip("builtin");
      continue;
    }
    if ("auth" in config && config.auth) {
      skip("official-auth");
      continue;
    }
    const stem = mcpStem(name);
    if (stem.includes("antigravity") || stem === "agy") {
      skip("antigravity-bridge");
      continue;
    }
    if (agyPluginStems.has(stem)) {
      skip("agy-plugin");
      continue;
    }
    if (config.type === "stdio") {
      if (!config.command) {
        skip("invalid");
        continue;
      }
      result.push({
        name: acpName(name, used),
        command: config.command,
        args: [...(config.args ?? [])],
        env: pairs(config.env),
      });
      continue;
    }
    if (config.oauth) {
      skip("oauth");
      continue;
    }
    result.push({
      type: config.type,
      name: acpName(name, used),
      url: config.url,
      headers: pairs(config.headers),
    });
  }
  return { servers: result, skipped };
}

/** Huella estable para saber si la sesión de agy debe reabrirse con otra lista. */
export function acpMcpFingerprint(servers: readonly AcpMcpServer[]): string {
  return JSON.stringify(servers);
}

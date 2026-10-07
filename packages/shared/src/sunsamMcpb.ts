/**
 * Sunsam: extensiones MCP empaquetadas (.mcpb, antes .dxt) — el formato de "Extensions" de Claude
 * Desktop (https://github.com/modelcontextprotocol/mcpb). Un paquete es un ZIP con `manifest.json`
 * en la raíz; este módulo contiene sólo lógica pura (validación del manifest y resolución de
 * `mcp_config` a la configuración de servidor MCP de ZCode) para poder probarla sin Electron.
 */
import type { McpServerConfig } from "./mcp.js";

/** Canales IPC del instalador (proceso principal de Electron). */
export const SUNSAM_MCPB_CHANNELS = {
  install: "sunsam:mcpb:install",
  configure: "sunsam:mcpb:configure",
  uninstall: "sunsam:mcpb:uninstall",
  browse: "sunsam:mcpb:browse",
  relaunch: "sunsam:mcpb:relaunch",
} as const;

export const SUNSAM_MCPB_FILE_EXTENSIONS = [".mcpb", ".dxt"] as const;

export type SunsamMcpbUserConfigType = "string" | "number" | "boolean" | "directory" | "file";

export interface SunsamMcpbUserConfigField {
  type: SunsamMcpbUserConfigType;
  title?: string;
  description?: string;
  required?: boolean;
  default?: string | number | boolean | string[];
  multiple?: boolean;
  sensitive?: boolean;
  min?: number;
  max?: number;
}

export interface SunsamMcpbMcpConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  platform_overrides?: Record<string, Partial<Omit<SunsamMcpbMcpConfig, "platform_overrides">>>;
}

export interface SunsamMcpbManifest {
  manifest_version?: string;
  /** Nombre del antiguo formato .dxt. */
  dxt_version?: string;
  name: string;
  version: string;
  display_name?: string;
  description?: string;
  author?: { name?: string; url?: string };
  icon?: string;
  server: {
    type: "node" | "python" | "binary" | "uv";
    entry_point?: string;
    mcp_config: SunsamMcpbMcpConfig;
  };
  user_config?: Record<string, SunsamMcpbUserConfigField>;
  compatibility?: { platforms?: string[]; runtimes?: Record<string, string> };
  tools?: { name: string; description?: string }[];
}

export type SunsamMcpbUserValue = string | number | boolean | string[];
export type SunsamMcpbUserValues = Record<string, SunsamMcpbUserValue>;

/** Resultado de instalar (o actualizar) un paquete, enviado del proceso principal a la UI. */
export interface SunsamMcpbInstallResult {
  /** Clave del servidor MCP (sunsamMcpbServerKey(manifest.name)). */
  serverName: string;
  displayName: string;
  version: string;
  description?: string;
  /** Versión instalada antes de esta subida; presente cuando es una actualización. */
  previousVersion?: string;
  userConfig: Record<string, SunsamMcpbUserConfigField>;
  /** Valores iniciales: guardados de una instalación anterior > detectados > `default` del manifest. */
  savedValues: SunsamMcpbUserValues;
  /** Rutas encontradas automáticamente para campos `directory` / `file` (modo automático). */
  detectedValues: Record<string, string>;
  /** Plataformas declaradas que no incluyen la actual (aviso, no bloqueo). */
  unsupportedPlatform?: string;
  iconDataUrl?: string;
  toolNames: string[];
}

export type SunsamMcpbIpcResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface SunsamMcpbBridge {
  install(file: {
    name: string;
    data: ArrayBuffer;
  }): Promise<SunsamMcpbIpcResult<SunsamMcpbInstallResult>>;
  configure(
    serverName: string,
    values: SunsamMcpbUserValues,
  ): Promise<SunsamMcpbIpcResult<McpServerConfig>>;
  uninstall(serverName: string): Promise<SunsamMcpbIpcResult<boolean>>;
  /** Selector nativo de carpeta o archivo (modo manual). Devuelve null si se cancela. */
  browse(
    kind: "directory" | "file",
    currentPath?: string,
  ): Promise<SunsamMcpbIpcResult<string | null>>;
  /** Reinicia Sunsam Code para que el agente cargue las extensiones instaladas. */
  relaunch(): Promise<void>;
}

/**
 * Clave estable del servidor MCP y de su carpeta a partir de `manifest.name`. El formato admite
 * cualquier texto ("Illustrator MCP"), así que se normaliza: "Illustrator MCP" → "illustrator-mcp".
 */
export function sunsamMcpbServerKey(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^[-._]+|[-._]+$/gu, "")
    .slice(0, 64)
    .replace(/[-._]+$/gu, "");
  if (slug) return slug;
  // Nombres sin letras latinas (p. ej. sólo CJK): hash corto y estable.
  let hash = 0;
  for (const char of name) hash = (Math.imul(hash, 31) + char.codePointAt(0)!) >>> 0;
  return `extension-${hash.toString(36)}`;
}

export function isSunsamMcpbServerKey(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,63}$/u.test(value);
}

export function isSunsamMcpbFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return SUNSAM_MCPB_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Valida la forma mínima del manifest. Lanza un Error legible si no sirve. */
export function parseSunsamMcpbManifest(raw: unknown): SunsamMcpbManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("manifest.json is not a JSON object");
  }
  const manifest = raw as Partial<SunsamMcpbManifest>;
  if (
    typeof manifest.name !== "string" ||
    manifest.name.trim() === "" ||
    manifest.name.length > 200
  ) {
    throw new Error("manifest.name is missing");
  }
  if (typeof manifest.version !== "string" || manifest.version.trim() === "") {
    throw new Error("manifest.version is missing");
  }
  const server = manifest.server;
  if (!server || typeof server !== "object") {
    throw new Error("manifest.server is missing");
  }
  const mcpConfig = server.mcp_config;
  if (!mcpConfig || typeof mcpConfig.command !== "string" || mcpConfig.command.trim() === "") {
    throw new Error("manifest.server.mcp_config.command is missing");
  }
  if (mcpConfig.args !== undefined && !Array.isArray(mcpConfig.args)) {
    throw new Error("manifest.server.mcp_config.args must be an array");
  }
  return manifest as SunsamMcpbManifest;
}

/** Valores iniciales del formulario: guardados > default del manifest. */
export function initialSunsamMcpbValues(
  userConfig: Record<string, SunsamMcpbUserConfigField> | undefined,
  saved: SunsamMcpbUserValues | undefined,
): SunsamMcpbUserValues {
  const values: SunsamMcpbUserValues = {};
  for (const [key, field] of Object.entries(userConfig ?? {})) {
    const value = saved?.[key] ?? field.default;
    if (value !== undefined) {
      values[key] = value;
    }
  }
  return values;
}

/** Claves obligatorias que siguen vacías. */
export function missingSunsamMcpbValues(
  userConfig: Record<string, SunsamMcpbUserConfigField> | undefined,
  values: SunsamMcpbUserValues,
): string[] {
  return Object.entries(userConfig ?? {})
    .filter(([key, field]) => field.required && isEmptyValue(values[key]))
    .map(([key]) => key);
}

function isEmptyValue(value: SunsamMcpbUserValue | undefined): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === "string" && value.trim() === "";
}

export interface SunsamMcpbResolveContext {
  /** Carpeta donde se extrajo el paquete (`${__dirname}`). */
  installDir: string;
  platform: NodeJS.Platform | string;
  pathSeparator: string;
  home: string;
  desktop: string;
  documents: string;
  downloads: string;
  /**
   * Cómo lanzar `node` cuando el manifest lo pide. Si no hay Node en el PATH, el proceso principal
   * usa el propio ejecutable de Electron con ELECTRON_RUN_AS_NODE=1 (como hace Claude Desktop).
   */
  nodeRuntime?: { command: string; env?: Record<string, string> };
}

const PLACEHOLDER = /\$\{([^}]+)\}/gu;

function stringifyValue(value: SunsamMcpbUserValue | undefined): string {
  if (value === undefined) return "";
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

function substitute(
  text: string,
  context: SunsamMcpbResolveContext,
  values: SunsamMcpbUserValues,
): string {
  return text.replace(PLACEHOLDER, (_match, rawKey: string) => {
    const key = rawKey.trim();
    if (key.startsWith("user_config.")) {
      return stringifyValue(values[key.slice("user_config.".length)]);
    }
    switch (key) {
      case "__dirname":
        return context.installDir;
      case "HOME":
        return context.home;
      case "DESKTOP":
        return context.desktop;
      case "DOCUMENTS":
        return context.documents;
      case "DOWNLOADS":
        return context.downloads;
      case "pathSeparator":
      case "/":
        return context.pathSeparator;
      default:
        return "";
    }
  });
}

const WHOLE_USER_CONFIG_PLACEHOLDER = /^\$\{\s*user_config\.([^}\s]+)\s*\}$/u;

/**
 * Convierte `server.mcp_config` del manifest en un servidor MCP stdio de ZCode.
 * - Aplica `platform_overrides[platform]`.
 * - Un argumento que es exactamente `${user_config.x}` se expande a varios si el valor es una
 *   lista, y se omite si está vacío (en vez de pasar un argumento vacío).
 * - Las variables de entorno que quedan vacías se omiten, para que el servidor use su default.
 */
export function resolveSunsamMcpbServerConfig(
  manifest: SunsamMcpbManifest,
  values: SunsamMcpbUserValues,
  context: SunsamMcpbResolveContext,
): McpServerConfig {
  const base = manifest.server.mcp_config;
  const override = base.platform_overrides?.[context.platform] ?? {};
  const merged = {
    command: override.command ?? base.command,
    args: override.args ?? base.args ?? [],
    env: { ...base.env, ...override.env },
  };

  const args: string[] = [];
  for (const arg of merged.args) {
    const whole = WHOLE_USER_CONFIG_PLACEHOLDER.exec(arg);
    if (whole) {
      const value = values[whole[1]!];
      if (Array.isArray(value)) {
        args.push(...value.filter((item) => item !== ""));
      } else if (!isEmptyValue(value)) {
        args.push(stringifyValue(value));
      }
      continue;
    }
    args.push(substitute(arg, context, values));
  }

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged.env)) {
    const resolved = substitute(String(value), context, values);
    if (resolved !== "") {
      env[key] = resolved;
    }
  }

  let command = substitute(merged.command, context, values);
  if (command === "node" && context.nodeRuntime) {
    command = context.nodeRuntime.command;
    Object.assign(env, context.nodeRuntime.env);
  }

  return {
    type: "stdio",
    command,
    args,
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };
}

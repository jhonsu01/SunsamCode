import type { MeshLogger } from "../app/ports.js";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Logger JSON por líneas en stderr. `debug` (datos por petición) sólo con SUNSAM_MESH_LOG=debug;
 * nunca se registran claves ni contenido de prompts.
 */
export function createConsoleLogger(level: Level = "info"): MeshLogger {
  const write = (entryLevel: Level, message: string, fields?: Record<string, unknown>) => {
    if (ORDER[entryLevel] < ORDER[level]) return;
    process.stderr.write(
      `${JSON.stringify({ ts: new Date().toISOString(), level: entryLevel, scope: "sunsam-mesh", message, ...fields })}\n`,
    );
  };
  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
  };
}

#!/usr/bin/env node
/**
 * CLI de Sunsam Mesh.
 *
 *   sunsam-mesh init  [--config ~/.sunsam/mesh.json]   crea una configuración de ejemplo
 *   sunsam-mesh serve [--config ~/.sunsam/mesh.json] [--port 4141] [--host 127.0.0.1]
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMeshConfig } from "../domain/config.js";
import { createConsoleLogger } from "./consoleLogger.js";
import { expandHome } from "./jsonlSink.js";
import { startMesh } from "./startMesh.js";

const DEFAULT_CONFIG_PATH = "~/.sunsam/mesh.json";
const EXAMPLE_CONFIG = resolve(dirname(fileURLToPath(import.meta.url)), "../../mesh.example.json");

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

async function main(argv: string[]): Promise<void> {
  const [command = "serve", ...args] = argv;
  const configPath = expandHome(readFlag(args, "config") ?? DEFAULT_CONFIG_PATH);

  if (command === "init") {
    if (await exists(configPath)) {
      process.stdout.write(`Ya existe ${configPath}; no se sobrescribe.\n`);
      return;
    }
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, await readFile(EXAMPLE_CONFIG, "utf8"), "utf8");
    process.stdout.write(
      `Configuración creada en ${configPath}. Edita los peers y ejecuta: sunsam-mesh serve\n`,
    );
    return;
  }
  if (command !== "serve") {
    process.stderr.write(
      `Comando desconocido: ${command}\nUso: sunsam-mesh [init|serve] [--config ruta] [--port n] [--host h]\n`,
    );
    process.exitCode = 2;
    return;
  }

  const raw = (await exists(configPath))
    ? (JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>)
    : {};
  const port = readFlag(args, "port");
  const host = readFlag(args, "host");
  const server = {
    ...(raw.server as Record<string, unknown> | undefined),
    ...(port ? { port: Number(port) } : {}),
    ...(host ? { host } : {}),
  };
  const config = parseMeshConfig({ ...raw, server });
  const logger = createConsoleLogger(process.env.SUNSAM_MESH_LOG === "debug" ? "debug" : "info");
  if (config.peers.length === 0)
    logger.warn("no hay peers configurados; ejecuta `sunsam-mesh init` y edita la configuración", {
      configPath,
    });
  const mesh = await startMesh(config, logger);
  const shutdown = () => {
    logger.info("apagando Sunsam Mesh");
    void mesh.close().finally(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

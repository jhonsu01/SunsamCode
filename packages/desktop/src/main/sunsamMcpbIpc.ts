/**
 * Sunsam: instalador de extensiones MCP empaquetadas (.mcpb / .dxt) en el proceso principal.
 *
 * - install: descomprime el paquete (con protección zip-slip) en
 *   `<userData>/extensions/<name>/<version>-<timestamp>`, valida `manifest.json` y devuelve lo que la
 *   UI necesita para pedir `user_config`. Volver a subir el mismo `name` es una actualización: se
 *   conservan los valores guardados y las carpetas anteriores se borran cuando ya no están en uso
 *   (en Windows un servidor en marcha puede tener bloqueados sus binarios nativos).
 * - configure: guarda los valores de `user_config` y devuelve la configuración stdio resuelta.
 * - uninstall: borra la extensión y sus valores.
 */
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, normalize, relative, sep } from "node:path";
import { app, ipcMain } from "electron";
import yauzl from "yauzl";
import {
  SUNSAM_MCPB_CHANNELS,
  initialSunsamMcpbValues,
  isSunsamMcpbFileName,
  missingSunsamMcpbValues,
  parseSunsamMcpbManifest,
  resolveSunsamMcpbServerConfig,
  type McpServerConfig,
  type SunsamMcpbInstallResult,
  type SunsamMcpbIpcResult,
  type SunsamMcpbManifest,
  type SunsamMcpbUserValues,
} from "@zcode/shared";

const MAX_PACKAGE_BYTES = 256 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 1024 * 1024 * 1024;
const MAX_ENTRIES = 20_000;
const MAX_ICON_BYTES = 512 * 1024;

interface InstallRecord {
  version: string;
  installDir: string;
  values: SunsamMcpbUserValues;
  installedAt: string;
}

interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

function extensionsRoot(): string {
  return join(app.getPath("userData"), "extensions");
}

function recordPath(name: string): string {
  return join(extensionsRoot(), `${name}.sunsam.json`);
}

async function readRecord(name: string): Promise<InstallRecord | null> {
  try {
    return JSON.parse(await readFile(recordPath(name), "utf8")) as InstallRecord;
  } catch {
    return null;
  }
}

async function writeRecord(name: string, record: InstallRecord): Promise<void> {
  await writeFile(recordPath(name), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

async function readManifest(installDir: string): Promise<SunsamMcpbManifest> {
  const raw = await readFile(join(installDir, "manifest.json"), "utf8");
  return parseSunsamMcpbManifest(JSON.parse(raw.replace(/^﻿/u, "")));
}

/** Ruta segura dentro de `root` para una entrada del ZIP, o null si intenta salir de ella. */
function safeEntryPath(root: string, entryName: string): string | null {
  const cleaned = entryName.replaceAll("\\", "/");
  if (cleaned.startsWith("/") || /^[A-Za-z]:/u.test(cleaned)) return null;
  const target = normalize(join(root, cleaned));
  const rel = relative(root, target);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return null;
  return target;
}

function extractZip(data: Buffer, targetDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(data, { lazyEntries: true }, (openError, zip) => {
      if (openError || !zip) {
        reject(openError ?? new Error("cannot open package"));
        return;
      }
      let entries = 0;
      let extracted = 0;
      const fail = (error: Error) => {
        zip.close();
        reject(error);
      };
      zip.on("error", fail);
      zip.on("end", () => resolve());
      zip.on("entry", (entry: yauzl.Entry) => {
        entries += 1;
        extracted += entry.uncompressedSize;
        if (entries > MAX_ENTRIES || extracted > MAX_EXTRACTED_BYTES) {
          fail(new Error("package is too large"));
          return;
        }
        const target = safeEntryPath(targetDir, entry.fileName);
        if (!target) {
          fail(new Error(`unsafe path in package: ${entry.fileName}`));
          return;
        }
        if (entry.fileName.endsWith("/")) {
          mkdir(target, { recursive: true }).then(() => zip.readEntry(), fail);
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            fail(streamError ?? new Error("cannot read package entry"));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("error", fail);
          stream.on("end", () => {
            mkdir(dirname(target), { recursive: true })
              .then(() => writeFile(target, Buffer.concat(chunks)))
              .then(() => zip.readEntry(), fail);
          });
        });
      });
      zip.readEntry();
    });
  });
}

function execText(command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { encoding: "utf8", timeout: 5000, windowsHide: true },
      (error, stdout) => resolve(error ? null : stdout.trim()),
    );
  });
}

function requiredNodeMajor(manifest: SunsamMcpbManifest): number {
  const range = manifest.compatibility?.runtimes?.["node"] ?? "";
  const match = /(\d+)/u.exec(range);
  return match ? Number(match[1]) : 0;
}

/** `node` del sistema si cumple la versión pedida; si no, el Node embebido de Electron. */
async function resolveNodeRuntime(
  manifest: SunsamMcpbManifest,
): Promise<{ command: string; env?: Record<string, string> }> {
  const version = await execText("node", ["--version"]);
  const major = version ? Number(/^v(\d+)/u.exec(version)?.[1] ?? 0) : 0;
  if (major > 0 && major >= requiredNodeMajor(manifest)) {
    return { command: "node" };
  }
  return { command: process.execPath, env: { ELECTRON_RUN_AS_NODE: "1" } };
}

async function iconDataUrl(
  installDir: string,
  icon: string | undefined,
): Promise<string | undefined> {
  if (!icon) return undefined;
  const path = safeEntryPath(installDir, icon);
  if (!path || !existsSync(path)) return undefined;
  const mime = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
  }[extname(path).toLowerCase()];
  if (!mime) return undefined;
  const data = await readFile(path);
  return data.byteLength <= MAX_ICON_BYTES
    ? `data:${mime};base64,${data.toString("base64")}`
    : undefined;
}

/** Borra versiones anteriores; las que siguen bloqueadas se reintentan en la próxima instalación. */
async function removeOldVersions(
  name: string,
  keepDir: string | null,
  logger: Logger,
): Promise<void> {
  const root = join(extensionsRoot(), name);
  let children: string[] = [];
  try {
    children = await readdir(root);
  } catch {
    return;
  }
  for (const child of children) {
    const dir = join(root, child);
    if (keepDir && normalize(dir) === normalize(keepDir)) continue;
    try {
      await rm(dir, { recursive: true, force: true, maxRetries: 2 });
    } catch (error) {
      logger.warn(`[sunsam-mcpb] old version still in use, will retry later: ${dir}`, error);
    }
  }
}

async function install(
  file: { name: string; data: ArrayBuffer },
  logger: Logger,
): Promise<SunsamMcpbInstallResult> {
  if (!isSunsamMcpbFileName(file.name)) {
    throw new Error("only .mcpb and .dxt files can be installed");
  }
  if (file.data.byteLength > MAX_PACKAGE_BYTES) {
    throw new Error("package is too large");
  }
  const staging = join(extensionsRoot(), `.staging-${randomBytes(6).toString("hex")}`);
  await mkdir(staging, { recursive: true });
  try {
    await extractZip(Buffer.from(file.data), staging);
    const manifest = await readManifest(staging);
    const previous = await readRecord(manifest.name);
    const installDir = join(
      extensionsRoot(),
      manifest.name,
      `${manifest.version.replace(/[^\w.-]/gu, "_")}-${Date.now()}`,
    );
    await mkdir(dirname(installDir), { recursive: true });
    await rename(staging, installDir);

    const values = initialSunsamMcpbValues(manifest.user_config, previous?.values);
    await writeRecord(manifest.name, {
      version: manifest.version,
      installDir,
      values,
      installedAt: new Date().toISOString(),
    });
    await removeOldVersions(manifest.name, installDir, logger);
    logger.info(
      `[sunsam-mcpb] installed ${manifest.name}@${manifest.version}` +
        (previous ? ` (was ${previous.version})` : "") +
        ` -> ${installDir}`,
    );

    const platforms = manifest.compatibility?.platforms;
    return {
      serverName: manifest.name,
      displayName: manifest.display_name || manifest.name,
      version: manifest.version,
      ...(manifest.description ? { description: manifest.description } : {}),
      ...(previous ? { previousVersion: previous.version } : {}),
      userConfig: manifest.user_config ?? {},
      savedValues: values,
      ...(platforms && platforms.length > 0 && !platforms.includes(process.platform)
        ? { unsupportedPlatform: platforms.join(", ") }
        : {}),
      ...(await iconDataUrl(installDir, manifest.icon).then((url) =>
        url ? { iconDataUrl: url } : {},
      )),
      toolNames: (manifest.tools ?? []).map((tool) => tool.name),
    };
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function configure(name: string, values: SunsamMcpbUserValues): Promise<McpServerConfig> {
  const record = await readRecord(name);
  if (!record || !existsSync(record.installDir)) {
    throw new Error(`extension ${name} is not installed`);
  }
  const manifest = await readManifest(record.installDir);
  const missing = missingSunsamMcpbValues(manifest.user_config, values);
  if (missing.length > 0) {
    throw new Error(`missing required settings: ${missing.join(", ")}`);
  }
  await writeRecord(name, { ...record, values });
  return resolveSunsamMcpbServerConfig(manifest, values, {
    installDir: record.installDir,
    platform: process.platform,
    pathSeparator: sep,
    home: app.getPath("home"),
    desktop: app.getPath("desktop"),
    documents: app.getPath("documents"),
    downloads: app.getPath("downloads"),
    nodeRuntime: await resolveNodeRuntime(manifest),
  });
}

async function uninstall(name: string, logger: Logger): Promise<boolean> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(name)) return false;
  const existed = (await readRecord(name)) !== null;
  await rm(recordPath(name), { force: true });
  await removeOldVersions(name, null, logger);
  await rm(join(extensionsRoot(), name), { recursive: true, force: true }).catch(() => undefined);
  return existed;
}

async function wrap<T>(run: () => Promise<T>, logger: Logger): Promise<SunsamMcpbIpcResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[sunsam-mcpb] ${message}`);
    return { ok: false, error: message };
  }
}

export function registerSunsamMcpbIpcHandlers(logger: Logger): void {
  ipcMain.handle(
    SUNSAM_MCPB_CHANNELS.install,
    (_event, file: { name: string; data: ArrayBuffer }) =>
      wrap(() => install(file, logger), logger),
  );
  ipcMain.handle(
    SUNSAM_MCPB_CHANNELS.configure,
    (_event, name: string, values: SunsamMcpbUserValues) =>
      wrap(() => configure(name, values), logger),
  );
  ipcMain.handle(SUNSAM_MCPB_CHANNELS.uninstall, (_event, name: string) =>
    wrap(() => uninstall(name, logger), logger),
  );
}

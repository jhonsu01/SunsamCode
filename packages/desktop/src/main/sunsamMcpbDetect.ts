/**
 * Sunsam: detección automática de rutas para los campos `directory` / `file` del `user_config` de
 * una extensión .mcpb (modo "automático" del formulario; el usuario siempre puede cambiar el valor
 * a mano o con "Examinar…").
 *
 * Pistas, en orden:
 * 1. Rutas absolutas escritas en `default`, `description` o `title`
 *    (p. ej. "Leave empty to use C:\Program Files\Audacity 4").
 * 2. Ejecutables mencionados ("vmde.exe", "ffmpeg.exe"): dentro de esas rutas, en el PATH y en las
 *    carpetas de programas (Program Files, Program Files (x86), %LOCALAPPDATA%\Programs).
 * 3. Para carpetas: la primera palabra significativa del título buscada en esas mismas raíces.
 */
import { execFile } from "node:child_process";
import type { Dirent } from "node:fs";
import { existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { SunsamMcpbUserConfigField } from "@zcode/shared";

const MAX_DIRS_VISITED = 4000;
const SEARCH_DEPTH = 3;
const STOP_WORDS = new Set([
  "folder",
  "directory",
  "dir",
  "path",
  "install",
  "installation",
  "executable",
  "file",
  "the",
  "optional",
  "carpeta",
  "ruta",
  "archivo",
  "ejecutable",
]);

export type SunsamMcpbDetectedValues = Record<string, string>;

function expandEnv(path: string): string {
  return path.replace(/%([^%]+)%/gu, (match, name: string) => process.env[name] ?? match);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Rutas absolutas de Windows dentro de un texto libre. */
export function extractWindowsPaths(text: string): string[] {
  const paths: string[] = [];
  for (const match of text.matchAll(/(?:[A-Za-z]:\\|%[A-Za-z_()]+%\\)[^"'\n<>|?*]*/gu)) {
    // El texto suele seguir tras la ruta ("…\Audacity 4. Leave empty…"): se corta en ". ", ")" o ", ".
    let cleaned = match[0].split(/\.\s|,\s|;\s/u)[0]!.replace(/[.\s]+$/u, "");
    // "(… C:\Program Files (x86)\Vector Magic)." → el ")" final sobra si los paréntesis no cuadran;
    // los de "(x86)" se conservan.
    const count = (char: string) => cleaned.split(char).length - 1;
    while (cleaned.endsWith(")") && count(")") > count("(")) {
      cleaned = cleaned.slice(0, -1).replace(/[.\s]+$/u, "");
    }
    if (cleaned.length > 3) paths.push(expandEnv(cleaned));
  }
  return paths;
}

/** Nombres de ejecutables mencionados ("vmde.exe", "ffmpeg.exe"). */
export function extractExecutableNames(text: string): string[] {
  return [
    ...new Set([...text.matchAll(/\b[\w.+-]+\.exe\b/giu)].map((match) => match[0].toLowerCase())),
  ];
}

function searchRoots(): string[] {
  const roots = [
    process.env["ProgramFiles"],
    process.env["ProgramFiles(x86)"],
    process.env["LOCALAPPDATA"] ? join(process.env["LOCALAPPDATA"], "Programs") : undefined,
  ];
  return [...new Set(roots.filter((root): root is string => Boolean(root) && isDirectory(root!)))];
}

function whereExecutable(name: string): Promise<string | null> {
  if (process.platform !== "win32") return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(
      "where",
      [name],
      { encoding: "utf8", timeout: 4000, windowsHide: true },
      (error, stdout) => {
        const first = error
          ? null
          : stdout
              .split(/\r?\n/u)
              .map((line) => line.trim())
              .find(Boolean);
        resolve(first && isFile(first) ? first : null);
      },
    );
  });
}

/** Búsqueda en anchura, con límite, de una entrada por nombre bajo las carpetas de programas. */
async function findUnderRoots(
  matches: (entryName: string) => boolean,
  wantDirectory: boolean,
): Promise<string | null> {
  let visited = 0;
  let level = searchRoots();
  for (let depth = 0; depth < SEARCH_DEPTH && level.length > 0; depth += 1) {
    const next: string[] = [];
    for (const dir of level) {
      if (++visited > MAX_DIRS_VISITED) return null;
      let entries: Dirent[] = [];
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      // Orden descendente: "Audacity 4" antes que "Audacity 3" (versiones nuevas primero).
      entries.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory() === wantDirectory && matches(entry.name)) return full;
        if (entry.isDirectory() && !entry.name.startsWith(".")) next.push(full);
      }
    }
    level = next;
  }
  return null;
}

export function titleKeyword(field: SunsamMcpbUserConfigField, key: string): string | null {
  const words = `${field.title ?? ""} ${key.replace(/[_-]+/gu, " ")}`
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/u.test(word));
  return words[0] ?? null;
}

async function detectField(key: string, field: SunsamMcpbUserConfigField): Promise<string | null> {
  const hints = [
    typeof field.default === "string" ? field.default : "",
    field.description ?? "",
    field.title ?? "",
  ].join("\n");
  const paths = extractWindowsPaths(hints);
  const executables = extractExecutableNames(hints);

  if (field.type === "directory") {
    const direct = paths.find(isDirectory);
    if (direct) return direct;
    const keyword = titleKeyword(field, key);
    return keyword ? findUnderRoots((name) => name.toLowerCase().startsWith(keyword), true) : null;
  }

  const directFile = paths.find(isFile);
  if (directFile) return directFile;
  for (const dir of paths.filter(isDirectory)) {
    const inside = executables
      .map((exe) => join(dir, exe))
      .find((candidate) => existsSync(candidate));
    if (inside) return inside;
  }
  for (const exe of executables) {
    const onPath = await whereExecutable(exe);
    if (onPath) return onPath;
  }
  for (const exe of executables) {
    const found = await findUnderRoots((name) => name.toLowerCase() === exe, false);
    if (found) return found;
  }
  return null;
}

/** Valores detectados para los campos de carpeta/archivo; los no encontrados se omiten. */
export async function detectSunsamMcpbPaths(
  userConfig: Record<string, SunsamMcpbUserConfigField> | undefined,
): Promise<SunsamMcpbDetectedValues> {
  const detected: SunsamMcpbDetectedValues = {};
  for (const [key, field] of Object.entries(userConfig ?? {})) {
    if ((field.type !== "directory" && field.type !== "file") || field.multiple) continue;
    const value = await detectField(key, field);
    if (value) detected[key] = value;
  }
  return detected;
}

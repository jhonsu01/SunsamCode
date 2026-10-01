#!/usr/bin/env node
/**
 * UI 文案 TS ⇄ JSON 转换，供 Crowdin 等翻译平台使用。
 * Converts the UI locale tables (packages/ui/src/i18n/locales/*.ts) to flat JSON and back,
 * so translation platforms such as Crowdin can work with them (see crowdin.yml).
 *
 *   node --import tsx scripts/i18n/locales-json.mjs export   # TS  -> .crowdin/
 *   node --import tsx scripts/i18n/locales-json.mjs import   # .crowdin/ -> TS (community locales)
 *
 * Options:
 *   --out <dir>            JSON directory (default: .crowdin)
 *   --locales-dir <dir>    TS locale directory (default: packages/ui/src/i18n/locales)
 *   --include-zh           also overwrite zh-CN.ts on import (it is maintained upstream by default)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_LOCALE = "en-US";
const UPSTREAM_LOCALES = ["zh-CN"];
const COMMUNITY_LOCALES = {
  "es-ES": "Spanish",
  "pt-BR": "Portuguese (Brazil)",
  "fr-FR": "French",
  "ru-RU": "Russian",
  "ko-KR": "Korean",
};

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

async function loadLocaleTable(localesDir, locale) {
  const file = path.resolve(localesDir, `${locale}.ts`);
  if (!existsSync(file)) return null;
  const module = await import(pathToFileURL(file).href);
  return module.default;
}

function variableName(locale) {
  return locale.replace("-", "");
}

function renderLocaleTable(locale, label, messages) {
  const lines = Object.entries(messages).map(
    ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`,
  );
  return [
    `/** ${label} translations — managed on Crowdin, keys mirror en-US.ts */`,
    `const ${variableName(locale)}: Record<string, string> = {`,
    ...lines,
    "};",
    "",
    `export default ${variableName(locale)};`,
    "",
  ].join("\n");
}

async function exportJson(localesDir, outDir) {
  const source = await loadLocaleTable(localesDir, SOURCE_LOCALE);
  await mkdir(path.join(outDir, "translations"), { recursive: true });
  await writeFile(
    path.join(outDir, `${SOURCE_LOCALE}.json`),
    `${JSON.stringify(source, null, 2)}\n`,
  );
  for (const locale of [...UPSTREAM_LOCALES, ...Object.keys(COMMUNITY_LOCALES)]) {
    const table = await loadLocaleTable(localesDir, locale);
    if (!table) continue;
    // 只导出与源文 key 对应的条目，避免把过期 key 推到翻译平台。
    const known = Object.fromEntries(Object.entries(table).filter(([key]) => key in source));
    await writeFile(
      path.join(outDir, "translations", `${locale}.json`),
      `${JSON.stringify(known, null, 2)}\n`,
    );
    console.log(`exported ${locale}: ${Object.keys(known).length} strings`);
  }
}

async function importJson(localesDir, outDir, includeZh) {
  const source = await loadLocaleTable(localesDir, SOURCE_LOCALE);
  const targets = {
    ...COMMUNITY_LOCALES,
    ...(includeZh ? { "zh-CN": "Chinese (Simplified)" } : {}),
  };
  for (const [locale, label] of Object.entries(targets)) {
    const file = path.join(outDir, "translations", `${locale}.json`);
    if (!existsSync(file)) continue;
    const translated = JSON.parse(await readFile(file, "utf8"));
    // 按 en-US 的顺序写回，丢弃未翻译的空串和源文中已不存在的 key；缺失的 key 在运行时回退英文。
    // 源文本身为空串的 key（如中文语序的后缀）保留空串。
    const isKept = (key) =>
      typeof translated[key] === "string" && (translated[key].trim() !== "" || source[key] === "");
    const ordered = Object.fromEntries(
      Object.keys(source)
        .filter(isKept)
        .map((key) => [key, translated[key]]),
    );
    await writeFile(
      path.resolve(localesDir, `${locale}.ts`),
      renderLocaleTable(locale, label, ordered),
    );
    console.log(`imported ${locale}: ${Object.keys(ordered).length}/${Object.keys(source).length}`);
  }
}

const [command, ...args] = process.argv.slice(2);
const localesDir = readOption(args, "--locales-dir", "packages/ui/src/i18n/locales");
const outDir = readOption(args, "--out", ".crowdin");

if (command === "export") {
  await exportJson(localesDir, outDir);
} else if (command === "import") {
  await importJson(localesDir, outDir, args.includes("--include-zh"));
  console.log("Run `pnpm fmt` afterwards to wrap long lines.");
} else {
  console.error(
    "usage: locales-json.mjs <export|import> [--out dir] [--locales-dir dir] [--include-zh]",
  );
  process.exit(1);
}

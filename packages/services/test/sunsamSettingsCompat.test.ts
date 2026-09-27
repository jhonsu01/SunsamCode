import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { createSettingService } from "../src/setting/settingService.ts";
import {
  SUNSAM_SETTINGS_SIDECAR_FILE,
  applySunsamLocaleSidecar,
  splitSunsamLocaleFields,
} from "../src/setting/sunsamSettingsCompat.ts";

// Lo que acepta el ZCode oficial en setting.json (upstream sólo conoce zh-CN y en-US).
const OFFICIAL_LOCALES = new Set(["zh-CN", "en-US"]);
const OFFICIAL_PREFERENCES = new Set(["system", "zh-CN", "en-US"]);

let home: string;
let previousHome: string | undefined;
let previousDesktopHome: string | undefined;

const settingsFile = () => join(home, ".zcode", "v2", "setting.json");
const readSettingsFile = async () =>
  JSON.parse(await readFile(settingsFile(), "utf-8")) as Record<string, unknown>;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "sunsam-settings-"));
  previousHome = process.env.HOME;
  previousDesktopHome = process.env.ZCODE_DESKTOP_HOME_DIR;
  process.env.HOME = home;
  process.env.ZCODE_DESKTOP_HOME_DIR = home;
});

afterEach(async () => {
  process.env.HOME = previousHome;
  if (previousDesktopHome === undefined) delete process.env.ZCODE_DESKTOP_HOME_DIR;
  else process.env.ZCODE_DESKTOP_HOME_DIR = previousDesktopHome;
  await rm(home, { recursive: true, force: true });
});

test("setting.json only contains locales the official ZCode can parse", async () => {
  const service = createSettingService();
  await service.update({
    locale: "es-ES",
    localePreference: "es-ES",
    dataBaseDir: "/mnt/datos",
    recentProjects: ["/mnt/datos/proyecto"],
  });

  const shared = await readSettingsFile();
  assert.ok(OFFICIAL_LOCALES.has(String(shared.locale)));
  assert.ok(OFFICIAL_PREFERENCES.has(String(shared.localePreference)));
  assert.equal(shared.dataBaseDir, "/mnt/datos");

  const sidecar = JSON.parse(
    await readFile(join(home, ".zcode", "v2", SUNSAM_SETTINGS_SIDECAR_FILE), "utf-8"),
  );
  assert.deepEqual(sidecar, { locale: "es-ES", localePreference: "es-ES" });

  const settings = await service.get();
  assert.equal(settings.locale, "es-ES");
  assert.equal(settings.localePreference, "es-ES");
});

test("a field this build cannot parse no longer wipes dataBaseDir and recent projects", async () => {
  const service = createSettingService();
  await service.update({ dataBaseDir: "/mnt/datos", recentProjects: ["/mnt/datos/proyecto"] });

  // Simula un ZCode oficial más nuevo que guarda un valor desconocido para este build.
  const shared = await readSettingsFile();
  await writeFile(settingsFile(), JSON.stringify({ ...shared, locale: "ja-JP" }));

  const settings = await service.get();
  assert.equal(settings.dataBaseDir, "/mnt/datos");
  assert.deepEqual(settings.recentProjects, ["/mnt/datos/proyecto"]);

  await service.update({ desktopZoomLevel: 1 });
  const rewritten = await readSettingsFile();
  assert.equal(rewritten.dataBaseDir, "/mnt/datos");
  assert.deepEqual(rewritten.recentProjects, ["/mnt/datos/proyecto"]);
});

test("a language chosen later in the official ZCode wins over the Sunsam one", async () => {
  const service = createSettingService();
  await service.update({ locale: "fr-FR", localePreference: "fr-FR" });

  const shared = await readSettingsFile();
  await writeFile(
    settingsFile(),
    JSON.stringify({ ...shared, locale: "zh-CN", localePreference: "zh-CN" }),
  );

  const settings = await service.get();
  assert.equal(settings.locale, "zh-CN");
  assert.equal(settings.localePreference, "zh-CN");
});

test("split and apply round-trip base and Sunsam locales", () => {
  const { shared, sidecar } = splitSunsamLocaleFields({
    locale: "ko-KR" as const,
    localePreference: "system" as const,
  });
  assert.deepEqual(shared, { locale: "en-US", localePreference: "system" });
  assert.deepEqual(sidecar, { locale: "ko-KR" });
  assert.deepEqual(applySunsamLocaleSidecar(shared, sidecar), {
    locale: "ko-KR",
    localePreference: "system",
  });
  assert.deepEqual(
    splitSunsamLocaleFields({ locale: "zh-CN", localePreference: "en-US" }).sidecar,
    {},
  );
});

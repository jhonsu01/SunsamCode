/**
 * Sunsam: el idioma Sunsam sobrevive al paso a 3.18 (uiLocale de upstream + sunsam-setting.json).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  appSettingsSchema,
  toPersistedSettingsLocaleFields,
  type AppSettings,
} from "@zcode/shared";
import {
  applySunsamLocaleSidecar,
  splitSunsamLocaleFields,
} from "../src/setting/sunsamSettingsCompat.ts";

function read(raw: Record<string, unknown>, sidecar: Record<string, unknown>): AppSettings {
  const parsed = appSettingsSchema.parse(raw) as AppSettings;
  return applySunsamLocaleSidecar(parsed, sidecar);
}

function write(settings: AppSettings) {
  return {
    file: { ...settings, ...toPersistedSettingsLocaleFields(settings) } as Record<string, unknown>,
    sidecar: splitSunsamLocaleFields(settings).sidecar as Record<string, unknown>,
  };
}

test("a Sunsam 3.17 Spanish user keeps Spanish after upgrading", () => {
  // Así lo dejaba Sunsam 3.17: setting.json en inglés y el idioma real en sunsam-setting.json.
  const settings = read(
    { locale: "en-US", localePreference: "en-US" },
    { locale: "es-ES", localePreference: "es-ES" },
  );
  assert.equal(settings.locale, "es-ES");
  assert.equal(settings.localePreference, "es-ES");
});

test("after a write, the new format alone keeps the language and older builds still read it", () => {
  const { file, sidecar } = write({ ...appSettingsSchema.parse({}), locale: "fr-FR", localePreference: "fr-FR" } as AppSettings);
  assert.equal(file.locale, "en-US");
  assert.equal(file.uiLocale, "fr-FR");
  assert.deepEqual(sidecar, { locale: "fr-FR", localePreference: "fr-FR" });
  // Sin sidecar (p. ej. otra máquina): uiLocale basta.
  assert.equal(read(file, {}).locale, "fr-FR");
  // Con sidecar: mismo resultado.
  assert.equal(read(file, sidecar).locale, "fr-FR");
});

test("switching back to English clears the Sunsam sidecar so it cannot revert the choice", () => {
  const { file, sidecar } = write({ ...appSettingsSchema.parse({}), locale: "en-US", localePreference: "en-US" } as AppSettings);
  assert.deepEqual(sidecar, {});
  assert.equal(read(file, sidecar).locale, "en-US");
});

test("upstream languages need no sidecar", () => {
  const { file, sidecar } = write({ ...appSettingsSchema.parse({}), locale: "ja-JP", localePreference: "ja-JP" } as AppSettings);
  assert.equal(read(file, sidecar).locale, "ja-JP");
});

/**
 * Sunsam: convivencia de ~/.zcode/v2/setting.json con una instalación oficial de ZCode.
 *
 * Las dos apps comparten setting.json (ruta de datos, proyectos recientes, sesión del espacio de
 * trabajo…). El ZCode oficial sólo acepta locale zh-CN/en-US: si encuentra "es-ES" su validación
 * falla, vuelve a los valores por defecto y en la siguiente escritura borra dataBaseDir y
 * recentProjects, por lo que Sunsam arranca después con los espacios de trabajo vacíos.
 *
 * Reglas (el único escritor sigue siendo settingService):
 * 1. En setting.json sólo se escriben locales que upstream entiende (toBaseLocale); el idioma
 *    Sunsam real vive en sunsam-setting.json, que el ZCode oficial nunca toca.
 * 2. Al leer, el idioma Sunsam sólo se aplica si setting.json sigue en su idioma base; si el
 *    ZCode oficial cambió el idioma, gana ese cambio.
 * 3. Si setting.json trae un campo que este build no entiende (p. ej. un ZCode oficial más nuevo),
 *    se descarta sólo ese campo en lugar de volver a los valores por defecto, para no perder la
 *    ruta de datos ni los proyectos recientes en la siguiente escritura.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isSupportedLocale,
  toBaseLocale,
  type AppSettings,
  type Locale,
  type LocalePreference,
} from "@zcode/shared";
import { atomicWriteText } from "../fs/atomicFileUtils.js";

export const SUNSAM_SETTINGS_SIDECAR_FILE = "sunsam-setting.json";

export interface SunsamLocaleSidecar {
  locale?: Locale;
  localePreference?: LocalePreference;
}

type LocaleFields = Pick<AppSettings, "locale" | "localePreference">;

const MAX_SALVAGE_ROUNDS = 20;

function isSunsamOnlyLocale(value: unknown): value is Locale {
  return isSupportedLocale(value) && toBaseLocale(value) !== value;
}

/** Separa los locales Sunsam: lo que va a setting.json y lo que va al archivo propio. */
export function splitSunsamLocaleFields<T extends LocaleFields>(
  settings: T,
): { shared: T; sidecar: SunsamLocaleSidecar } {
  const shared = { ...settings };
  const sidecar: SunsamLocaleSidecar = {};
  if (isSunsamOnlyLocale(settings.locale)) {
    sidecar.locale = settings.locale;
    shared.locale = toBaseLocale(settings.locale);
  }
  if (isSunsamOnlyLocale(settings.localePreference)) {
    sidecar.localePreference = settings.localePreference;
    shared.localePreference = toBaseLocale(settings.localePreference);
  }
  return { shared, sidecar };
}

/** Vuelve a aplicar el idioma Sunsam si setting.json no fue cambiado a otro idioma entretanto. */
export function applySunsamLocaleSidecar<T extends LocaleFields>(
  settings: T,
  sidecar: SunsamLocaleSidecar,
): T {
  const merged = { ...settings };
  if (sidecar.locale && toBaseLocale(sidecar.locale) === settings.locale) {
    merged.locale = sidecar.locale;
  }
  if (
    sidecar.localePreference &&
    sidecar.localePreference !== "system" &&
    toBaseLocale(sidecar.localePreference) === settings.localePreference
  ) {
    merged.localePreference = sidecar.localePreference;
  }
  return merged;
}

export function parseSunsamLocaleSidecar(value: unknown): SunsamLocaleSidecar {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const sidecar: SunsamLocaleSidecar = {};
  if (isSunsamOnlyLocale(raw.locale)) sidecar.locale = raw.locale;
  if (isSunsamOnlyLocale(raw.localePreference)) sidecar.localePreference = raw.localePreference;
  return sidecar;
}

export async function readSunsamLocaleSidecar(settingsDir: string): Promise<SunsamLocaleSidecar> {
  try {
    const raw = await readFile(join(settingsDir, SUNSAM_SETTINGS_SIDECAR_FILE), "utf-8");
    return parseSunsamLocaleSidecar(JSON.parse(raw));
  } catch {
    // Archivo ausente o dañado: sin idioma Sunsam guardado, se usa el de setting.json.
    return {};
  }
}

export async function writeSunsamLocaleSidecar(
  settingsDir: string,
  sidecar: SunsamLocaleSidecar,
): Promise<void> {
  await atomicWriteText(
    join(settingsDir, SUNSAM_SETTINGS_SIDECAR_FILE),
    JSON.stringify(sidecar, null, 2),
  );
}

interface SafeParseSchema<T> {
  safeParse(
    value: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: ReadonlyArray<{ path: PropertyKey[] }> } };
}

/**
 * Si la validación falla, descarta sólo los campos de primer nivel que dan error y vuelve a
 * validar. Devuelve null si ni así se obtiene una configuración válida.
 */
export function salvageSettings<T>(
  schema: SafeParseSchema<T>,
  rawValue: unknown,
): { data: T; droppedKeys: string[] } | null {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) return null;
  const candidate: Record<string, unknown> = { ...(rawValue as Record<string, unknown>) };
  const droppedKeys: string[] = [];
  for (let round = 0; round < MAX_SALVAGE_ROUNDS; round += 1) {
    const result = schema.safeParse(candidate);
    if (result.success) return { data: result.data, droppedKeys };
    const keys = new Set(
      result.error.issues
        .map((issue) => issue.path[0])
        .filter((key): key is string => typeof key === "string" && key in candidate),
    );
    if (keys.size === 0) return null;
    for (const key of keys) {
      delete candidate[key];
      droppedKeys.push(key);
    }
  }
  return null;
}

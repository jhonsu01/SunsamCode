/**
 * Sunsam: registro de los idiomas de interfaz añadidos por Sunsam (upstream sólo trae zh-CN y
 * en-US). Cada tabla usa las mismas claves que `i18n/locales/en-US.ts`; las que falten se
 * muestran en inglés, así las claves nuevas de upstream nunca aparecen vacías.
 */
import type { BaseLocale, Locale } from "@zcode/shared";
import esES from "./es-ES.js";
import frFR from "./fr-FR.js";
import koKR from "./ko-KR.js";
import ptBR from "./pt-BR.js";
import ruRU from "./ru-RU.js";

export type SunsamLocale = Exclude<Locale, BaseLocale>;

interface SunsamLocaleOption {
  locale: SunsamLocale;
  /** Nombre del idioma en su propio idioma, igual en todas las interfaces. */
  nativeName: string;
  /** Etiqueta corta para el botón que alterna idiomas. */
  shortLabel: string;
  messages: Record<string, string>;
}

export const SUNSAM_LOCALE_OPTIONS: readonly SunsamLocaleOption[] = [
  { locale: "es-ES", nativeName: "Español", shortLabel: "Es", messages: esES },
  { locale: "pt-BR", nativeName: "Português (Brasil)", shortLabel: "Pt", messages: ptBR },
  { locale: "fr-FR", nativeName: "Français", shortLabel: "Fr", messages: frFR },
  { locale: "ru-RU", nativeName: "Русский", shortLabel: "Ру", messages: ruRU },
  { locale: "ko-KR", nativeName: "한국어", shortLabel: "한", messages: koKR },
];

/** Tabla completa de un idioma Sunsam: inglés como base y la traducción encima. */
export function withEnglishFallback(
  enUS: Record<string, string>,
  locale: SunsamLocale,
): Record<string, string> {
  const option = SUNSAM_LOCALE_OPTIONS.find((candidate) => candidate.locale === locale);
  return { ...enUS, ...option?.messages };
}

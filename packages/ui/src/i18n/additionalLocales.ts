/**
 * 社区贡献的界面语言（zh-CN / en-US 之外）。
 * Community-contributed UI languages besides zh-CN / en-US.
 *
 * 每个语言表与 `locales/en-US.ts` 使用相同的 key；缺失的 key 回退到英文，
 * 因此新增的英文文案在翻译补齐前不会显示为空。
 * Each table uses the same keys as `locales/en-US.ts`; missing keys fall back to English,
 * so newly added English strings never render empty before translators catch up.
 * Translations are managed on Crowdin (see `crowdin.yml` and `docs/i18n/CONTRIBUTING.md`).
 */
import type { BaseLocale, Locale } from "@zcode/shared";
import esES from "./locales/es-ES.js";
import ptBR from "./locales/pt-BR.js";
import frFR from "./locales/fr-FR.js";
import ruRU from "./locales/ru-RU.js";
import koKR from "./locales/ko-KR.js";

export type AdditionalLocale = Exclude<Locale, BaseLocale>;

interface AdditionalLocaleOption {
  locale: AdditionalLocale;
  /** 语言自称，所有界面语言下保持一致。Language name in its own language. */
  nativeName: string;
  /** 语言切换按钮上的短标签。Short label for the locale toggle button. */
  shortLabel: string;
  messages: Record<string, string>;
}

export const ADDITIONAL_LOCALE_OPTIONS: readonly AdditionalLocaleOption[] = [
  { locale: "es-ES", nativeName: "Español", shortLabel: "Es", messages: esES },
  { locale: "pt-BR", nativeName: "Português (Brasil)", shortLabel: "Pt", messages: ptBR },
  { locale: "fr-FR", nativeName: "Français", shortLabel: "Fr", messages: frFR },
  { locale: "ru-RU", nativeName: "Русский", shortLabel: "Ру", messages: ruRU },
  { locale: "ko-KR", nativeName: "한국어", shortLabel: "한", messages: koKR },
];

/** 完整语言表：英文打底，翻译覆盖其上。Full table: English base with the translation on top. */
export function withEnglishFallback(
  enUS: Record<string, string>,
  locale: AdditionalLocale,
): Record<string, string> {
  const option = ADDITIONAL_LOCALE_OPTIONS.find((candidate) => candidate.locale === locale);
  return { ...enUS, ...option?.messages };
}

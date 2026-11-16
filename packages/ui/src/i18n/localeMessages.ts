import type { Locale } from "@zcode/shared";
import zhCN from "./locales/zh-CN.js";
import enUS from "./locales/en-US.js";
import jaJP from "./locales/ja-JP.js";
import ruRU from "./locales/ru-RU.js";
import koKR from "./locales/ko-KR.js";
import { withEnglishFallback } from "@/sunsam/locales/index.js";

/**
 * 语言 → 翻译消息映射。IntlProvider 与 ErrorBoundary 共用这一份。
 * 日/俄/韩文案表可能缺 key（例如官方版本安全校验文案只有中英），缺失时先回退 en-US，
 * 避免界面直接露出 key；中文表是完整的，不需要合并。
 *
 * Sunsam: es-ES / pt-BR / fr-FR usan las tablas de Sunsam. En ru-RU y ko-KR manda la traducción
 * oficial de upstream y la de Sunsam sólo cubre las claves que upstream no tiene (las de Sunsam).
 */
export const LOCALE_MESSAGES: Record<Locale, Record<string, string>> = {
  "zh-CN": zhCN,
  "en-US": enUS,
  "es-ES": withEnglishFallback(enUS, "es-ES"),
  "pt-BR": withEnglishFallback(enUS, "pt-BR"),
  "fr-FR": withEnglishFallback(enUS, "fr-FR"),
  "ja-JP": { ...enUS, ...jaJP },
  "ru-RU": { ...withEnglishFallback(enUS, "ru-RU"), ...ruRU },
  "ko-KR": { ...withEnglishFallback(enUS, "ko-KR"), ...koKR },
};

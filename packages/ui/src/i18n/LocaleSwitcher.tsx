import { useCallback } from "react";
import type { Locale } from "@zcode/shared";
import { TID_LOCALE_TOGGLE } from "@zcode/shared";
import { useZCodeIntl } from "./IntlProvider.js";
import { SUNSAM_LOCALE_OPTIONS, type SunsamLocale } from "@/sunsam/locales/index.js";

// Sunsam: los idiomas añadidos vienen del registro de la capa Sunsam.
const LOCALE_CYCLE: Locale[] = [
  "zh-CN",
  "en-US",
  ...SUNSAM_LOCALE_OPTIONS.map((option) => option.locale),
];

const LOCALE_LABELS: Record<Locale, string> = {
  "zh-CN": "中",
  "en-US": "En",
  ...(Object.fromEntries(
    SUNSAM_LOCALE_OPTIONS.map((option) => [option.locale, option.shortLabel]),
  ) as Record<SunsamLocale, string>),
};

/**
 * 语言切换按钮 —— 点击循环切换语言
 */
export function LocaleSwitcher() {
  const { intl, locale, setLocale } = useZCodeIntl();

  const cycleLocale = useCallback(() => {
    const idx = LOCALE_CYCLE.indexOf(locale);
    const next = LOCALE_CYCLE[(idx + 1) % LOCALE_CYCLE.length] ?? LOCALE_CYCLE[0]!;
    setLocale(next);
  }, [locale, setLocale]);

  return (
    <button
      onClick={cycleLocale}
      data-testid={TID_LOCALE_TOGGLE}
      className="cursor-pointer rounded-lg bg-btn-alt-bg px-3 py-1 text-ui-base text-btn-alt-text transition hover:bg-surface-raised"
      title={intl.formatMessage({ id: "locale.switchLanguage" })}
    >
      {LOCALE_LABELS[locale]}
    </button>
  );
}

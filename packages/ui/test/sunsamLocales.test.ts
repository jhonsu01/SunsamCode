import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedLocale, resolveLocaleFromLanguageTag, toBaseLocale } from "@zcode/shared";
import enUS from "../src/i18n/locales/en-US.ts";
import { SUNSAM_LOCALE_OPTIONS, withEnglishFallback } from "../src/sunsam/locales/index.ts";

const PLACEHOLDER = /\{[A-Za-z_]+\}/g;
const placeholders = (text: string) => (text.match(PLACEHOLDER) ?? []).toSorted();

for (const { locale, messages } of SUNSAM_LOCALE_OPTIONS) {
  test(`${locale} only uses keys that exist in en-US`, () => {
    const unknown = Object.keys(messages).filter((key) => !(key in enUS));
    assert.deepEqual(unknown, []);
  });

  test(`${locale} keeps every {placeholder} of the English text`, () => {
    const mismatched = Object.entries(messages)
      .filter(([key, value]) => {
        const english = enUS[key];
        return english !== undefined && placeholders(english).join() !== placeholders(value).join();
      })
      .map(([key]) => key);
    assert.deepEqual(mismatched, []);
  });

  test(`${locale} falls back to English for keys it does not translate`, () => {
    const merged = withEnglishFallback(enUS, locale);
    assert.equal(Object.keys(merged).length, Object.keys(enUS).length);
    assert.ok(isSupportedLocale(locale));
    assert.equal(toBaseLocale(locale), "en-US");
  });
}

test("system language tags resolve to the matching Sunsam locale", () => {
  assert.equal(resolveLocaleFromLanguageTag("es-MX"), "es-ES");
  assert.equal(resolveLocaleFromLanguageTag("pt-PT"), "pt-BR");
  assert.equal(resolveLocaleFromLanguageTag("pt"), "pt-BR");
  assert.equal(resolveLocaleFromLanguageTag("fr-CA"), "fr-FR");
  assert.equal(resolveLocaleFromLanguageTag("ru"), "ru-RU");
  assert.equal(resolveLocaleFromLanguageTag("ko_KR"), "ko-KR");
  assert.equal(resolveLocaleFromLanguageTag("zh-TW"), "zh-CN");
  assert.equal(resolveLocaleFromLanguageTag("de-DE"), "en-US");
  assert.equal(resolveLocaleFromLanguageTag(undefined), "en-US");
  assert.equal(isSupportedLocale("de-DE"), false);
  assert.equal(toBaseLocale("zh-CN"), "zh-CN");
});

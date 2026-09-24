import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedLocale, resolveLocaleFromLanguageTag, toBaseLocale } from "@zcode/shared";
import enUS from "../src/i18n/locales/en-US.ts";
import esES from "../src/sunsam/locales/es-ES.ts";

const PLACEHOLDER = /\{[A-Za-z_]+\}/g;
const placeholders = (text: string) => (text.match(PLACEHOLDER) ?? []).toSorted();

test("es-ES only uses keys that exist in en-US", () => {
  const unknown = Object.keys(esES).filter((key) => !(key in enUS));
  assert.deepEqual(unknown, []);
});

test("es-ES keeps every {placeholder} of the English text", () => {
  const mismatched = Object.entries(esES)
    .filter(([key, value]) => {
      const english = enUS[key];
      return english !== undefined && placeholders(english).join() !== placeholders(value).join();
    })
    .map(([key]) => key);
  assert.deepEqual(mismatched, []);
});

test("Spanish language tags resolve to es-ES and fall back to English for zh/en-only services", () => {
  assert.equal(resolveLocaleFromLanguageTag("es-MX"), "es-ES");
  assert.equal(resolveLocaleFromLanguageTag("es"), "es-ES");
  assert.equal(resolveLocaleFromLanguageTag("zh-TW"), "zh-CN");
  assert.equal(resolveLocaleFromLanguageTag("fr-FR"), "en-US");
  assert.equal(isSupportedLocale("es-ES"), true);
  assert.equal(isSupportedLocale("fr-FR"), false);
  assert.equal(toBaseLocale("es-ES"), "en-US");
  assert.equal(toBaseLocale("zh-CN"), "zh-CN");
});

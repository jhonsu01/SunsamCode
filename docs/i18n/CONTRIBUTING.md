# Translating ZCode / 翻译 ZCode

ZCode's UI ships in **English** (source) and **Simplified Chinese**, plus community translations in
**Español**, **Português (Brasil)**, **Français**, **Русский** and **한국어**.

## Translate on Crowdin (no code needed)

Translations are collected on Crowdin: **https://crowdin.com/project/zcode-i18n**

1. Sign in to Crowdin and open the project — it is public, anyone can join.
2. Pick your language and translate or review strings in the online editor.
3. Keep every `{placeholder}` exactly as in English (e.g. `{model}`, `{count}`).
4. Product and feature names (ZCode, Start Plan, Coding Plan, MCP…) stay untranslated.

Missing a language? Open an issue or ask on the Crowdin project and it will be added.

## How translations reach the code

Source strings live in `packages/ui/src/i18n/locales/en-US.ts`. Each language is a table with the
same keys; any key a language does not translate falls back to English at runtime
(`packages/ui/src/i18n/additionalLocales.ts`), so new strings never show up empty.

Crowdin works with flat JSON, so the TS tables are converted in both directions:

```bash
pnpm i18n:export      # TS -> .crowdin/en-US.json + .crowdin/translations/<locale>.json
crowdin upload sources
crowdin download      # needs CROWDIN_PROJECT_ID and CROWDIN_PERSONAL_TOKEN (see crowdin.yml)
pnpm i18n:import      # .crowdin/translations -> packages/ui/src/i18n/locales/*.ts
```

`zh-CN.ts` is maintained by the core team and is only overwritten with `--include-zh`.

## Adding a new language (developers)

1. Add the locale to `SUPPORTED_LOCALES` and `LANGUAGE_PREFIX_TO_LOCALE` in
   `packages/shared/src/protocol.ts`.
2. Add `packages/ui/src/i18n/locales/<locale>.ts` and register it in
   `packages/ui/src/i18n/additionalLocales.ts` (native name + short label).
3. Add the native menu/tray strings in `packages/shared/src/desktopMenuLocales.ts`, the language
   name keys (`settings.locale.<locale>`, `sidebar.settings.locale.<locale>`) in `en-US.ts` and
   `zh-CN.ts`, and the entries the type checker asks for (`pnpm typecheck`).
4. Run `node --import tsx --test packages/ui/test/locales.test.ts` — it checks that every key exists
   in English and that placeholders match.

---

**中文**：界面以英文为源语言，翻译在 Crowdin 上协作完成（项目公开，任何人都可加入）。
请保持 `{占位符}` 与英文一致；未翻译的 key 会自动回退为英文。`zh-CN.ts` 仍由核心团队维护。

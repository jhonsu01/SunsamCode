/**
 * Sunsam Code 品牌覆盖层（Sunsam brand overlay）。
 *
 * 目的：把 fork 的品牌定制集中在少数几个文件里，使 upstream（zai-org/ZCode）更新时
 * 冲突面最小。上游文件只在入口处调用这里的函数，而不是逐条修改 i18n 文案。
 *
 * Capa de personalización de Sunsam: todos los ajustes de marca se concentran aquí
 * para que las actualizaciones de upstream se fusionen con el menor número de conflictos.
 */

import { SUNSAM_PRODUCT_NAME, applySunsamBrandToText, type Locale } from "@zcode/shared";

export const SUNSAM_BRAND = Object.freeze({
  productName: SUNSAM_PRODUCT_NAME,
  shortName: "Sunsam",
  /**
   * Oculta en Model settings el grupo "Providers" (Z.ai / Start Plan / Coding Plan) y deja
   * únicamente "Custom providers". Los datos de upstream no se borran: solo se ocultan en la UI,
   * así que reactivarlo es cambiar este flag.
   */
  hideBuiltinModelProviders: true,
});

/**
 * Textos exclusivos de Sunsam. Viven aquí (y no en los locales de upstream) para que las
 * actualizaciones de `en-US.ts` / `zh-CN.ts` no choquen con la capa de personalización.
 */
const SUNSAM_LOCALE_LABELS: Record<string, string> = {
  "settings.locale.es-ES": "Español",
  "sidebar.settings.locale.es-ES": "Español",
};

const SUNSAM_MESSAGES: Record<Locale, Record<string, string>> = {
  "en-US": {
    ...SUNSAM_LOCALE_LABELS,
    "sunsam.modelProvider.customOnlyEmpty":
      "No custom providers yet. Use “Add provider” to connect an OpenAI- or Anthropic-compatible endpoint (LM Studio, Ollama, vLLM, Sunsam Mesh…).",
  },
  "zh-CN": {
    ...SUNSAM_LOCALE_LABELS,
    "sunsam.modelProvider.customOnlyEmpty":
      "还没有自定义供应商。点击“添加供应商”连接兼容 OpenAI 或 Anthropic 的端点（LM Studio、Ollama、vLLM、Sunsam Mesh 等）。",
  },
  "es-ES": {
    ...SUNSAM_LOCALE_LABELS,
    "sunsam.modelProvider.customOnlyEmpty":
      "Aún no hay proveedores personalizados. Usa «Añadir proveedor» para conectar un endpoint compatible con OpenAI o Anthropic (LM Studio, Ollama, vLLM, Sunsam Mesh…).",
  },
};

const brandedMessagesCache = new WeakMap<Record<string, string>, Record<string, string>>();

/**
 * Devuelve una copia de la tabla de mensajes con el nombre de producto reemplazado y los
 * textos propios de Sunsam añadidos. Se memoiza por tabla para que cambiar de idioma no
 * vuelva a recorrer todos los mensajes.
 */
export function applySunsamBrandToMessages(
  messages: Record<string, string>,
  locale: string,
): Record<string, string> {
  const cached = brandedMessagesCache.get(messages);
  if (cached) {
    return cached;
  }
  const branded: Record<string, string> = {};
  for (const [id, message] of Object.entries(messages)) {
    branded[id] = applySunsamBrandToText(message);
  }
  Object.assign(
    branded,
    SUNSAM_MESSAGES[locale as keyof typeof SUNSAM_MESSAGES] ?? SUNSAM_MESSAGES["en-US"],
  );
  brandedMessagesCache.set(messages, branded);
  return branded;
}

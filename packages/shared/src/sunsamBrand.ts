/**
 * Sunsam Code: sustitución del nombre de producto de upstream en textos visibles.
 *
 * Se comparte entre Renderer (i18n de la UI) y Main (menús nativos y bandeja) para que haya
 * una única regla de marca. "ZCode CLI" y "ZCode CDN" se conservan porque nombran el binario
 * y la infraestructura de upstream; `\b` evita tocar identificadores como `ZCodeStore`.
 */
export const SUNSAM_PRODUCT_NAME = "Sunsam Code";

const UPSTREAM_PRODUCT_NAME_PATTERN = /\bZ ?Code\b(?! (?:CLI|CDN)\b)/g;

export function applySunsamBrandToText(text: string): string {
  return text.replace(UPSTREAM_PRODUCT_NAME_PATTERN, SUNSAM_PRODUCT_NAME);
}

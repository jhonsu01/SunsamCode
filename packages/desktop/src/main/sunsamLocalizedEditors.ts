/**
 * Sunsam: upstream registra el Explorador de Windows como editor con el nombre fijo "资源管理器"
 * (main/editors.ts), que se ve en chino en los menús "Abrir" sea cual sea el idioma. Aquí se
 * traduce al idioma actual de la app usando el nombre que da Windows en cada idioma.
 */
import { DEFAULT_LOCALE, type EditorInfo, type Locale } from "@zcode/shared";

const FILE_EXPLORER_NAMES: Record<Locale, string> = {
  "zh-CN": "资源管理器",
  "en-US": "File Explorer",
  "es-ES": "Explorador de archivos",
  "pt-BR": "Explorador de Arquivos",
  "fr-FR": "Explorateur de fichiers",
  "ru-RU": "Проводник",
  "ko-KR": "파일 탐색기",
};

let currentLocale: Locale = DEFAULT_LOCALE;

/** Se llama al reconstruir el menú de la app, que ocurre al arrancar y al cambiar de idioma. */
export function setSunsamMainLocale(locale: Locale): void {
  currentLocale = locale;
}

export function localizeSunsamEditors(
  editors: EditorInfo[],
  locale: Locale = currentLocale,
): EditorInfo[] {
  return editors.map((editor) =>
    editor.id === "explorer"
      ? { ...editor, name: FILE_EXPLORER_NAMES[locale] ?? FILE_EXPLORER_NAMES["en-US"] }
      : editor,
  );
}

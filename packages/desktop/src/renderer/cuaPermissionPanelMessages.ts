import type { CuaPermissionKind, Locale } from "@zcode/shared";

interface CuaPermissionPanelMessages {
  documentTitle: string;
  dragTitle: string;
  hintPrefix: string;
  permissionLabel: string;
  hintSuffix: string;
  completion: string;
}

const MESSAGES: Record<
  Locale,
  Omit<CuaPermissionPanelMessages, "permissionLabel"> & Record<CuaPermissionKind, string>
> = {
  "zh-CN": {
    documentTitle: "ZCode Computer Use 权限",
    dragTitle: "拖动我到上面的权限列表",
    hintPrefix: "把左边的图标拖进上方的",
    hintSuffix: "列表",
    completion: "松手即完成授权，无需再点开关",
    accessibility: "辅助功能",
    screen_recording: "屏幕录制",
  },
  "en-US": {
    documentTitle: "ZCode Computer Use Permissions",
    dragTitle: "Drag me to the permission list above",
    hintPrefix: "Drag the icon on the left into the ",
    hintSuffix: " list above",
    completion: "Release to grant access—no need to toggle the switch",
    accessibility: "Accessibility",
    screen_recording: "Screen Recording",
  },
  // Sunsam
  "es-ES": {
    documentTitle: "Permisos de Computer Use de Sunsam Code",
    dragTitle: "Arrástrame a la lista de permisos de arriba",
    hintPrefix: "Arrastra el icono de la izquierda a la lista ",
    hintSuffix: " de arriba",
    completion: "Suelta para conceder el acceso; no hace falta activar el interruptor",
    accessibility: "Accesibilidad",
    screen_recording: "Grabación de pantalla",
  },
  "pt-BR": {
    documentTitle: "Permissões do Computer Use do Sunsam Code",
    dragTitle: "Arraste-me para a lista de permissões acima",
    hintPrefix: "Arraste o ícone da esquerda para a lista ",
    hintSuffix: " acima",
    completion: "Solte para conceder o acesso; não é preciso ativar a chave",
    accessibility: "Acessibilidade",
    screen_recording: "Gravação de Tela",
  },
  "fr-FR": {
    documentTitle: "Autorisations Computer Use de Sunsam Code",
    dragTitle: "Faites-moi glisser dans la liste des autorisations ci-dessus",
    hintPrefix: "Faites glisser l’icône de gauche dans la liste ",
    hintSuffix: " ci-dessus",
    completion: "Relâchez pour accorder l’accès, inutile d’activer l’interrupteur",
    accessibility: "Accessibilité",
    screen_recording: "Enregistrement de l’écran",
  },
  "ru-RU": {
    documentTitle: "Разрешения Computer Use для Sunsam Code",
    dragTitle: "Перетащите меня в список разрешений выше",
    hintPrefix: "Перетащите значок слева в список «",
    hintSuffix: "» выше",
    completion: "Отпустите, чтобы выдать доступ — переключатель включать не нужно",
    accessibility: "Универсальный доступ",
    screen_recording: "Запись экрана",
  },
  "ko-KR": {
    documentTitle: "Sunsam Code Computer Use 권한",
    dragTitle: "위의 권한 목록으로 끌어다 놓으세요",
    hintPrefix: "왼쪽 아이콘을 위의 ",
    hintSuffix: " 목록으로 끌어다 놓으세요",
    completion: "놓으면 권한이 부여됩니다. 스위치를 켤 필요가 없습니다",
    accessibility: "손쉬운 사용",
    screen_recording: "화면 기록",
  },
};

export function resolveCuaPermissionPanelMessages(
  locale: Locale,
  permission: CuaPermissionKind,
): CuaPermissionPanelMessages {
  const messages = MESSAGES[locale];
  return {
    documentTitle: messages.documentTitle,
    dragTitle: messages.dragTitle,
    hintPrefix: messages.hintPrefix,
    permissionLabel: messages[permission],
    hintSuffix: messages.hintSuffix,
    completion: messages.completion,
  };
}

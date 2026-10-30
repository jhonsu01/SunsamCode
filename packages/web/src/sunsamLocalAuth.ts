/**
 * Sunsam: "login" del móvil contra el relay local de la app de escritorio.
 *
 * El control remoto de upstream (Relay V2) exige iniciar sesión en el teléfono con la misma cuenta
 * de Z.ai que el equipo y usa ese JWT para pedir tokens. Con el relay local de Sunsam no hay cuenta:
 * el QR trae un secreto en el fragmento `#k=` (el navegador nunca lo envía en las peticiones) y ese
 * secreto hace de JWT. Se guarda en este navegador para que recargar la página siga funcionando.
 */
import type { WebAuthService } from "./auth/webAuthService.js";

type EntryAuth = Pick<
  WebAuthService,
  "getZCodeJwtToken" | "getActiveAccount" | "startLogin" | "logout"
>;

const STORAGE_KEY = "sunsam-remote-local-key";

function isZaiHost(hostname: string): boolean {
  return /(^|\.)z\.ai$/i.test(hostname) || /(^|\.)bigmodel\.cn$/i.test(hostname);
}

/** Secreto del QR (fragmento `k`) o el guardado de una visita anterior al mismo equipo. */
export function readSunsamLocalKey(
  location: Pick<Location, "hash" | "hostname">,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined,
): string | null {
  if (isZaiHost(location.hostname)) return null;
  const fromQr = new URLSearchParams(location.hash.replace(/^#/, "")).get("k")?.trim();
  if (fromQr) {
    try {
      storage?.setItem(STORAGE_KEY, fromQr);
    } catch {
      // Modo privado sin almacenamiento: vale para esta visita.
    }
    return fromQr;
  }
  try {
    return storage?.getItem(STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

/** Auth del entry de upstream: con secreto local, ese secreto; si no, la cuenta de Z.ai. */
export function resolveSunsamEntryAuth(
  base: EntryAuth,
  key: string | null,
  storage?: Pick<Storage, "removeItem">,
): EntryAuth {
  if (!key) return base;
  return {
    getZCodeJwtToken: () => key,
    getActiveAccount: () => null,
    startLogin: (...args: Parameters<EntryAuth["startLogin"]>) => base.startLogin(...args),
    logout: async () => {
      // "Cambiar de cuenta" olvida este equipo: hará falta escanear de nuevo su QR.
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        // sin almacenamiento
      }
    },
  };
}

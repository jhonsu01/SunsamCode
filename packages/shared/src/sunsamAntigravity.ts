/**
 * Sunsam: proveedor «Google (Antigravity)». Los modelos de la suscripción de Google se usan a través
 * del CLI oficial `agy` (protocolo ACP); Sunsam nunca lee ni guarda tokens de Google.
 * Este módulo solo tiene constantes, tipos y lógica pura, compartidos por el escritorio y la UI.
 */

/** URL que marca un proveedor como Antigravity: el CLI la enruta a `agy acp`, no a HTTP. */
export const SUNSAM_ANTIGRAVITY_BASE_URL = "agy-acp://local";
/** El esquema de proveedores exige una clave; esta no es secreta ni se envía a ningún sitio. */
export const SUNSAM_ANTIGRAVITY_PLACEHOLDER_KEY = "google-account";
export const SUNSAM_ANTIGRAVITY_PROVIDER_NAME = "Google (Antigravity)";
export const SUNSAM_ANTIGRAVITY_CONTEXT_WINDOW = 1_048_576;
export const SUNSAM_ANTIGRAVITY_MAX_OUTPUT_TOKENS = 65_536;

export const SUNSAM_ANTIGRAVITY_CHANNELS = {
  status: "sunsam:antigravity:status",
  loginStart: "sunsam:antigravity:login-start",
  loginFinish: "sunsam:antigravity:login-finish",
  loginCancel: "sunsam:antigravity:login-cancel",
} as const;

export interface SunsamAntigravityModel {
  /** Id que acepta `session/set_config_option` (sin sufijo de nivel). */
  readonly id: string;
  readonly name: string;
  /** Niveles de razonamiento que ofrece este modelo, de menor a mayor; vacío si no razona. */
  readonly thoughtLevels: readonly string[];
}

export interface SunsamAntigravityStatus {
  readonly installed: boolean;
  readonly agyPath?: string;
  readonly version?: string;
  readonly signedIn: boolean;
  readonly tier?: { readonly name?: string; readonly id?: string; readonly upgradeUri?: string };
  readonly models: readonly SunsamAntigravityModel[];
  readonly error?: string;
}

export interface SunsamAntigravityLoginStart {
  readonly loginId: string;
  readonly url: string;
}

export type SunsamAntigravityResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export interface SunsamAntigravityBridge {
  status(): Promise<SunsamAntigravityResult<SunsamAntigravityStatus>>;
  loginStart(): Promise<SunsamAntigravityResult<SunsamAntigravityLoginStart>>;
  loginFinish(loginId: string, code: string): Promise<SunsamAntigravityResult<{ account?: string }>>;
  loginCancel(loginId: string): Promise<SunsamAntigravityResult<null>>;
}

export function isSunsamAntigravityBaseUrl(baseUrl: string | null | undefined): boolean {
  return typeof baseUrl === "string" && baseUrl.trim().toLowerCase().startsWith("agy-acp:");
}

/**
 * Configuración de modelo para `addPersonalModel`. Debe ceñirse al esquema de modelos manuales
 * (`manualModelConfigSchema` de @zcode/provider), que solo admite los campos editables por el usuario.
 * El mapa de razonamiento queda vacío: agy no es una API HTTP, el nivel lo aplica el CLI de Sunsam
 * con `session/set_config_option`.
 */
export function sunsamAntigravityModelConfig(model: SunsamAntigravityModel) {
  return {
    enabled: true,
    properties: {
      contextWindow: SUNSAM_ANTIGRAVITY_CONTEXT_WINDOW,
      supportsJsonSchemaOutput: false,
      supportsNativeWebSearch: false,
      supportsMidConversationSystem: false,
      inputFormat: { supportsImage: true, supportsVideo: false, supportsPdf: false },
    },
    optionSpecs: {
      reasoningLevel: {
        values: model.thoughtLevels.length > 0 ? [...model.thoughtLevels] : ["default"],
        map: "{}",
      },
      maxOutputTokens: { max: SUNSAM_ANTIGRAVITY_MAX_OUTPUT_TOKENS },
    },
  };
}

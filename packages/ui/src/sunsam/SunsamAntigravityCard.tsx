// Sunsam: tarjeta de la cuenta de Google (Antigravity) en Ajustes de modelos, y creación del
// proveedor en un clic. Los modelos viven en la lista normal del proveedor; aquí solo se muestra
// lo que ofrece la cuenta y se añaden los que falten.
import {
  SUNSAM_ANTIGRAVITY_BASE_URL,
  SUNSAM_ANTIGRAVITY_PLACEHOLDER_KEY,
  SUNSAM_ANTIGRAVITY_PROVIDER_NAME,
  isSunsamAntigravityBaseUrl,
  sunsamAntigravityModelConfig,
  type SunsamAntigravityBridge,
  type SunsamAntigravityModel,
  type SunsamAntigravityStatus,
} from "@zcode/shared";
import type { IProviderSettingsService } from "@zcode/services";
import { CheckIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import type { ProviderSettingsFormProvider } from "@/lib/providerSettingsFormTypes.js";

type AntigravityWindow = Window & { zcode?: { sunsamAntigravity?: SunsamAntigravityBridge } };

export function getSunsamAntigravityBridge(): SunsamAntigravityBridge | undefined {
  return typeof window === "undefined"
    ? undefined
    : (window as AntigravityWindow).zcode?.sunsamAntigravity;
}

export function isSunsamAntigravityProvider(
  provider: Pick<ProviderSettingsFormProvider, "config"> | null | undefined,
): boolean {
  return isSunsamAntigravityBaseUrl(provider?.config.api?.baseUrl);
}

const DEFAULT_MODEL: SunsamAntigravityModel = {
  id: "gemini-3.8-flash",
  name: "Gemini 3.8 Flash",
  thoughtLevels: ["low", "medium", "high"],
};

/** Crea el proveedor con su configuración fija y el primer Gemini Flash de la cuenta. */
export async function createSunsamAntigravityProvider(deps: {
  createPersonalProvider: (input: { providerName: string; locale?: "zh-CN" | "en-US" }) => Promise<{
    providerId: string;
  }>;
  providerSettingsService: Pick<IProviderSettingsService, "savePersonalProviderOverlay">;
  addPersonalModel: (
    providerId: string,
    modelId: string,
    config: never,
    useRecommendedConfig?: boolean,
  ) => Promise<unknown>;
}): Promise<string> {
  const status = await getSunsamAntigravityBridge()?.status();
  const models = status?.ok && status.value.models.length > 0 ? status.value.models : [DEFAULT_MODEL];
  const first =
    models.find((model) => /flash/i.test(model.id) && /gemini/i.test(model.id)) ??
    models.find((model) => /gemini/i.test(model.id)) ??
    models[0]!;
  const created = await deps.createPersonalProvider({ providerName: SUNSAM_ANTIGRAVITY_PROVIDER_NAME });
  await deps.providerSettingsService.savePersonalProviderOverlay(created.providerId, {
    group: "standard-personal",
    access: { type: "api-key", apiKey: SUNSAM_ANTIGRAVITY_PLACEHOLDER_KEY },
    api: { type: "openai-chat-completions", baseUrl: SUNSAM_ANTIGRAVITY_BASE_URL },
  });
  await deps.addPersonalModel(
    created.providerId,
    first.id,
    sunsamAntigravityModelConfig(first) as never,
    false,
  );
  return created.providerId;
}

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly status: SunsamAntigravityStatus }
  | { readonly kind: "error"; readonly error: string };

export function SunsamAntigravityCard({
  provider,
  onAddModel,
}: {
  provider: ProviderSettingsFormProvider;
  onAddModel: (providerId: string, modelId: string, config: never, useRecommended?: boolean) => Promise<unknown>;
}) {
  const { intl } = useZCodeIntl();
  const t = useCallback(
    (id: string, values?: Record<string, string>) => intl.formatMessage({ id }, values),
    [intl],
  );
  const bridge = getSunsamAntigravityBridge();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [login, setLogin] = useState<{ loginId: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bridge) {
      setState({ kind: "error", error: "desktop only" });
      return;
    }
    setState({ kind: "loading" });
    const result = await bridge.status();
    setState(result.ok ? { kind: "ready", status: result.value } : { kind: "error", error: result.error });
  }, [bridge]);

  useEffect(() => {
    void load();
  }, [load]);

  const startLogin = async () => {
    if (!bridge) return;
    setBusy(true);
    setNotice(null);
    const result = await bridge.loginStart();
    setBusy(false);
    if (result.ok) setLogin({ loginId: result.value.loginId });
    else setNotice(t("sunsam.antigravity.error", { error: result.error }));
  };

  const finishLogin = async () => {
    if (!bridge || !login || !code.trim()) return;
    setBusy(true);
    const result = await bridge.loginFinish(login.loginId, code);
    setBusy(false);
    setLogin(null);
    setCode("");
    setNotice(
      result.ok
        ? t("sunsam.antigravity.loginDone", { account: result.value.account ? ` (${result.value.account})` : "" })
        : t("sunsam.antigravity.error", { error: result.error }),
    );
    void load();
  };

  const cancelLogin = () => {
    if (bridge && login) void bridge.loginCancel(login.loginId);
    setLogin(null);
    setCode("");
  };

  const listed = new Set(provider.models.map((model) => model.modelId));
  const addModels = async (models: readonly SunsamAntigravityModel[]) => {
    setBusy(true);
    try {
      for (const model of models) {
        if (listed.has(model.id)) continue;
        await onAddModel(provider.providerId, model.id, sunsamAntigravityModelConfig(model) as never, false);
      }
    } catch (error) {
      setNotice(t("sunsam.antigravity.error", { error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(false);
    }
  };

  const status = state.kind === "ready" ? state.status : undefined;
  const missing = status?.models.filter((model) => !listed.has(model.id)) ?? [];

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-4" data-sunsam-antigravity-card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-ui-base font-semibold text-foreground">{t("sunsam.antigravity.title")}</h3>
          {state.kind === "loading" ? (
            <p className="flex items-center gap-2 text-ui-sm text-foreground-subtle">
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
              {t("sunsam.antigravity.checking")}
            </p>
          ) : state.kind === "error" ? (
            <p className="text-ui-sm text-destructive">{t("sunsam.antigravity.error", { error: state.error })}</p>
          ) : !status!.installed ? (
            <p className="text-ui-sm text-foreground-subtle">{t("sunsam.antigravity.notInstalled")}</p>
          ) : (
            <div className="space-y-0.5 text-ui-sm text-foreground-subtle">
              <p className={status!.signedIn ? "text-foreground" : undefined}>
                {status!.signedIn ? t("sunsam.antigravity.signedIn") : t("sunsam.antigravity.signedOut")}
                {status!.tier?.name ? ` · ${t("sunsam.antigravity.plan", { plan: status!.tier.name })}` : ""}
              </p>
              {status!.version ? <p>{t("sunsam.antigravity.version", { version: status!.version })}</p> : null}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {status?.tier?.upgradeUri ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(status.tier!.upgradeUri, "_blank", "noopener")}
            >
              {t("sunsam.antigravity.upgrade")}
            </Button>
          ) : null}
          {status?.installed && !login ? (
            <Button type="button" variant={status.signedIn ? "outline" : "default"} size="sm" disabled={busy} onClick={() => void startLogin()}>
              {status.signedIn ? t("sunsam.antigravity.reconnect") : t("sunsam.antigravity.signIn")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("sunsam.antigravity.recheck")}
            title={t("sunsam.antigravity.recheck")}
            disabled={state.kind === "loading" || busy}
            onClick={() => void load()}
          >
            <RefreshCwIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {login ? (
        <div className="space-y-2 rounded-lg bg-hover p-3">
          <p className="text-ui-sm text-foreground-subtle">{t("sunsam.antigravity.codeHint")}</p>
          <div className="flex gap-2">
            <input
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-ui-sm outline-none focus-visible:border-ring"
              value={code}
              placeholder={t("sunsam.antigravity.codePlaceholder")}
              autoFocus
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void finishLogin();
              }}
            />
            <Button type="button" size="sm" disabled={busy || !code.trim()} onClick={() => void finishLogin()}>
              {t("sunsam.antigravity.codeSubmit")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={cancelLogin}>
              {t("sunsam.antigravity.cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      {notice ? <p className="text-ui-sm text-foreground-subtle">{notice}</p> : null}

      {status?.signedIn && status.models.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-ui-sm font-medium text-foreground">{t("sunsam.antigravity.modelsTitle")}</h4>
            {missing.length > 0 ? (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void addModels(missing)}>
                {t("sunsam.antigravity.addAll")}
              </Button>
            ) : null}
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {status.models.map((model) => (
              <li key={model.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-ui-sm text-foreground">
                    {model.name} <span className="font-mono text-foreground-subtlest">{model.id}</span>
                  </p>
                  {model.thoughtLevels.length > 0 ? (
                    <p className="text-ui-xs text-foreground-subtlest">
                      {t("sunsam.antigravity.levels", { levels: model.thoughtLevels.join(" · ") })}
                    </p>
                  ) : null}
                </div>
                {listed.has(model.id) ? (
                  <span className="flex shrink-0 items-center gap-1 text-ui-xs text-foreground-subtle">
                    <CheckIcon className="size-3.5" aria-hidden="true" />
                    {t("sunsam.antigravity.inList")}
                  </span>
                ) : (
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void addModels([model])}>
                    {t("sunsam.antigravity.addModel")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-ui-xs text-foreground-subtlest">{t("sunsam.antigravity.modelsHint")}</p>
        </div>
      ) : null}
      <p className="text-ui-xs text-foreground-subtlest">{t("sunsam.antigravity.tools")}</p>
    </section>
  );
}

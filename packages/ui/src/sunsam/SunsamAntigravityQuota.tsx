// Sunsam: cuota de la cuenta de Google (Antigravity) — barras por grupo de modelos con el
// porcentaje restante y cuándo se renueva. Datos de `agy -p "/usage"` (sin gastar cuota).
import {
  isSunsamAntigravityBaseUrl,
  type SunsamAntigravityBridge,
  type SunsamAntigravityQuota,
  type SunsamAntigravityQuotaBucket,
} from "@zcode/shared";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/components/lib/utils.js";
import { useProviderSettingsServiceView } from "@/hooks/useProviderSettingsView.js";
import { useServices } from "@/hooks/useServices.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";

type AntigravityWindow = Window & { zcode?: { sunsamAntigravity?: SunsamAntigravityBridge } };

function bridge(): SunsamAntigravityBridge | undefined {
  return typeof window === "undefined"
    ? undefined
    : (window as AntigravityWindow).zcode?.sunsamAntigravity;
}

export type SunsamQuotaState =
  | { readonly kind: "idle" | "loading" }
  | { readonly kind: "ready"; readonly quota: SunsamAntigravityQuota; readonly refreshing: boolean }
  | { readonly kind: "error"; readonly error: string };

/** Carga la cuota cuando `enabled`; `refresh(true)` fuerza una lectura nueva. */
export function useSunsamAntigravityQuota(enabled: boolean) {
  const [state, setState] = useState<SunsamQuotaState>({ kind: "idle" });
  const refresh = useCallback(
    async (force = false) => {
      const api = bridge();
      if (!enabled || !api?.quota) return;
      setState((current) =>
        current.kind === "ready" ? { ...current, refreshing: true } : { kind: "loading" },
      );
      const result = await api.quota(force);
      setState((current) =>
        result.ok
          ? { kind: "ready", quota: result.value, refreshing: false }
          : current.kind === "ready"
            ? { ...current, refreshing: false }
            : { kind: "error", error: result.error },
      );
    },
    [enabled],
  );
  useEffect(() => {
    if (enabled) void refresh(false);
    else setState({ kind: "idle" });
  }, [enabled, refresh]);
  return { state, refresh };
}

/** ¿El proveedor del modelo elegido es Google (Antigravity)? */
export function useIsSunsamAntigravityProvider(providerId: string | null | undefined): boolean {
  const { providerSettingsService } = useServices();
  const read = useProviderSettingsServiceView(providerSettingsService);
  return useMemo(() => {
    if (!providerId || read.state.status !== "ready") return false;
    const provider = read.state.view.providers.find((entry) => entry.providerId === providerId);
    return isSunsamAntigravityBaseUrl(provider?.effectiveConfig.api?.baseUrl);
  }, [providerId, read.state]);
}

function bucketLabel(bucket: SunsamAntigravityQuotaBucket, t: (id: string) => string): string {
  const window = (bucket.window ?? "").toLowerCase();
  if (window.includes("week")) return t("sunsam.antigravity.quota.weekly");
  if (window.includes("five") || window.includes("5h") || window.includes("hour")) {
    return t("sunsam.antigravity.quota.fiveHour");
  }
  if (window.includes("day")) return t("sunsam.antigravity.quota.daily");
  return bucket.name;
}

function formatReset(iso: string | undefined, locale: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const sameDay = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(locale, sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function barTone(fraction: number): string {
  if (fraction <= 0.1) return "bg-destructive";
  if (fraction <= 0.3) return "bg-warning";
  return "bg-[#4285F4]";
}

export function SunsamAntigravityQuotaView({
  state,
  onRefresh,
  compact = false,
  className,
}: {
  state: SunsamQuotaState;
  onRefresh?: () => void;
  compact?: boolean;
  className?: string;
}) {
  const { intl, locale } = useZCodeIntl();
  const t = useCallback((id: string, values?: Record<string, string>) => intl.formatMessage({ id }, values), [intl]);
  const percent = useMemo(
    () => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }),
    [locale],
  );
  if (state.kind === "idle") return null;
  const refreshing = state.kind === "loading" || (state.kind === "ready" && state.refreshing);
  return (
    <div className={cn("space-y-2", className)} data-sunsam-antigravity-quota>
      <div className="flex items-center gap-2">
        <span className={cn("font-medium text-foreground", compact ? "text-ui-base" : "text-ui-sm")}>
          {t("sunsam.antigravity.quota.title")}
        </span>
        {refreshing ? (
          <Loader2Icon className="size-3.5 animate-spin text-foreground-subtle" aria-hidden="true" />
        ) : onRefresh ? (
          <button
            type="button"
            className="text-foreground-subtlest hover:text-foreground"
            aria-label={t("sunsam.antigravity.quota.refresh")}
            title={t("sunsam.antigravity.quota.refresh")}
            onClick={onRefresh}
          >
            <RefreshCwIcon className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {state.kind === "error" ? (
        <p className="text-ui-xs text-destructive">{t("sunsam.antigravity.error", { error: state.error })}</p>
      ) : state.kind === "ready" ? (
        <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
          {state.quota.groups.flatMap((group) =>
            group.buckets.map((bucket) => {
              const fraction = bucket.remainingFraction;
              const reset = formatReset(bucket.resetTime, locale);
              return (
                <div
                  key={`${group.name}:${bucket.id}`}
                  className="space-y-1 rounded-lg bg-surface px-3 py-2"
                  title={[group.description, bucket.description].filter(Boolean).join("\n")}
                >
                  <div className="flex min-w-0 items-baseline justify-between gap-2 text-ui-xs">
                    <span className="min-w-0 truncate text-foreground-subtle">
                      {group.name} · {bucketLabel(bucket, t)}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-ui-sm font-semibold text-foreground">
                      {fraction === undefined ? t("sunsam.antigravity.quota.disabled") : percent.format(fraction)}
                    </span>
                    {reset ? (
                      <span className="truncate text-ui-xs text-foreground-subtlest">
                        {t("sunsam.antigravity.quota.resets", { time: reset })}
                      </span>
                    ) : null}
                  </div>
                  {fraction !== undefined ? (
                    <div className="h-1.5 overflow-hidden rounded-full bg-hover">
                      <div
                        className={cn("h-full rounded-full", barTone(fraction))}
                        style={{ width: `${Math.max(2, fraction * 100)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            }),
          )}
          {state.quota.credits?.remaining !== undefined ? (
            <div className="flex items-center justify-between gap-2 px-1 text-ui-xs text-foreground-subtle">
              <span>{t("sunsam.antigravity.quota.credits")}</span>
              <span className="font-mono text-foreground">{state.quota.credits.remaining}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

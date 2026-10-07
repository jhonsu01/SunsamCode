/**
 * Sunsam: instalar extensiones MCP empaquetadas (.mcpb / .dxt) desde la pantalla "Servidores MCP",
 * como "Extensiones" en Claude Desktop: botón o arrastrar y soltar; volver a subir el mismo paquete
 * lo actualiza conservando su configuración. Sólo aparece en escritorio (necesita el proceso main).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, PackagePlus, RotateCcw, Sparkles, Upload } from "lucide-react";
import {
  isSunsamMcpbFileName,
  missingSunsamMcpbValues,
  type McpServerConfig,
  type SunsamMcpbBridge,
  type SunsamMcpbInstallResult,
  type SunsamMcpbUserValue,
  type SunsamMcpbUserValues,
} from "@zcode/shared";
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { Input } from "@/components/ui/input.js";
import { Switch } from "@/components/ui/switch.js";
import { toast } from "@/components/ui/toast.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";

// El paquete ui no ve las declaraciones de window.zcode del renderer de escritorio (igual que
// logger.ts): el puente se lee con un tipo local y no existe en web ni en remoto.
type SunsamMcpbWindow = Window & { zcode?: { sunsamMcpb?: SunsamMcpbBridge } };

export function getSunsamMcpbBridge(): SunsamMcpbBridge | undefined {
  return typeof window === "undefined" ? undefined : (window as SunsamMcpbWindow).zcode?.sunsamMcpb;
}

interface McpbInstallerProps {
  /** Añade o actualiza el servidor MCP de usuario con la configuración resuelta. */
  onRegister: (serverName: string, config: McpServerConfig) => Promise<void>;
}

interface PendingConfig {
  result: SunsamMcpbInstallResult;
  values: SunsamMcpbUserValues;
}

function hasDraggedFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.items ?? []).some((item) => item.kind === "file");
}

export function SunsamMcpbInstaller({ onRegister }: McpbInstallerProps) {
  const { intl } = useZCodeIntl();
  const bridge = getSunsamMcpbBridge();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<PendingConfig[]>([]);
  const pending = queue[0] ?? null;
  const [saving, setSaving] = useState(false);
  // Las extensiones instaladas/actualizadas se cargan en el agente al reiniciar Sunsam Code.
  const [restartNames, setRestartNames] = useState<string[]>([]);

  const t = useCallback(
    (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values),
    [intl],
  );

  const finish = useCallback(
    async (result: SunsamMcpbInstallResult, values: SunsamMcpbUserValues) => {
      if (!bridge) return false;
      const configured = await bridge.configure(result.serverName, values);
      if (!configured.ok) {
        toast(t("sunsam.mcpb.error", { error: configured.error }), { variant: "warning" });
        return false;
      }
      await onRegister(result.serverName, configured.value);
      setRestartNames((current) =>
        current.includes(result.displayName) ? current : [...current, result.displayName],
      );
      toast(
        result.previousVersion
          ? t("sunsam.mcpb.updated", {
              name: result.displayName,
              from: result.previousVersion,
              to: result.version,
            })
          : t("sunsam.mcpb.installed", { name: result.displayName, version: result.version }),
        { variant: "info" },
      );
      return true;
    },
    [bridge, onRegister, t],
  );

  const installFiles = useCallback(
    async (files: File[]) => {
      if (!bridge) return;
      const packages = files.filter((file) => isSunsamMcpbFileName(file.name));
      if (packages.length === 0) {
        toast(t("sunsam.mcpb.unsupportedFile"), { variant: "warning" });
        return;
      }
      setBusy(true);
      try {
        for (const file of packages) {
          const installed = await bridge.install({
            name: file.name,
            data: await file.arrayBuffer(),
          });
          if (!installed.ok) {
            toast(t("sunsam.mcpb.error", { error: installed.error }), { variant: "warning" });
            continue;
          }
          const result = installed.value;
          if (result.unsupportedPlatform) {
            toast(t("sunsam.mcpb.platformWarning", { platforms: result.unsupportedPlatform }), {
              variant: "warning",
            });
          }
          const hasFields = Object.keys(result.userConfig).length > 0;
          const missing = missingSunsamMcpbValues(result.userConfig, result.savedValues);
          // Instalación nueva con ajustes, o actualización a la que le falta algo obligatorio:
          // se pide la configuración. Una actualización completa conserva los valores guardados.
          if (hasFields && (!result.previousVersion || missing.length > 0)) {
            setQueue((current) => [...current, { result, values: result.savedValues }]);
            continue;
          }
          await finish(result, result.savedValues);
        }
      } finally {
        setBusy(false);
      }
    },
    [bridge, finish, t],
  );

  // Se escucha el arrastre en el contenedor padre (toda la sección "Servidores MCP") para no
  // tener que envolver el JSX de upstream.
  useEffect(() => {
    const area = rootRef.current?.parentElement;
    if (!bridge || !area) return undefined;
    let depth = 0;
    const onDragEnter = (event: DragEvent) => {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (event: DragEvent) => {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      void installFiles(Array.from(event.dataTransfer?.files ?? []));
    };
    area.addEventListener("dragenter", onDragEnter);
    area.addEventListener("dragleave", onDragLeave);
    area.addEventListener("dragover", onDragOver);
    area.addEventListener("drop", onDrop);
    return () => {
      area.removeEventListener("dragenter", onDragEnter);
      area.removeEventListener("dragleave", onDragLeave);
      area.removeEventListener("dragover", onDragOver);
      area.removeEventListener("drop", onDrop);
    };
  }, [bridge, installFiles]);

  if (!bridge) {
    return null;
  }

  const setValue = (key: string, value: SunsamMcpbUserValue) =>
    setQueue(([first, ...rest]) =>
      first ? [{ ...first, values: { ...first.values, [key]: value } }, ...rest] : [],
    );
  const closeCurrent = () => setQueue(([, ...rest]) => rest);
  const browse = async (key: string, kind: "directory" | "file", current: string) => {
    const picked = await bridge.browse(kind, current || undefined);
    if (picked.ok && picked.value) setValue(key, picked.value);
  };

  const missing = pending ? missingSunsamMcpbValues(pending.result.userConfig, pending.values) : [];

  return (
    <div ref={rootRef} data-sunsam-mcpb-dropzone="true">
      {restartNames.length > 0 ? (
        <div
          role="status"
          className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
        >
          <RotateCcw className="size-4 shrink-0 text-foreground-subtle" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-ui-base text-foreground">
            {t("sunsam.mcpb.restartNeeded", { names: restartNames.join(", ") })}
          </span>
          <Button type="button" size="lg" onClick={() => void bridge.relaunch()}>
            {t("sunsam.mcpb.restartNow")}
          </Button>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <PackagePlus data-icon="inline-start" aria-hidden="true" />
          {busy ? t("sunsam.mcpb.installing") : t("sunsam.mcpb.install")}
        </Button>
        <span className="flex items-center gap-1.5 text-ui-base text-foreground-subtle">
          <Upload className="size-3.5" aria-hidden="true" />
          {t("sunsam.mcpb.dropHint")}
        </span>
        <span className="basis-full text-ui-sm text-foreground-subtle">
          {t("sunsam.mcpb.restartHint")}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".mcpb,.dxt"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void installFiles(files);
          }}
        />
      </div>

      {dragging ? (
        <div className="pointer-events-none fixed inset-4 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/85 text-ui-lg font-medium text-foreground">
          {t("sunsam.mcpb.dropNow")}
        </div>
      ) : null}

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => (!open && !saving ? closeCurrent() : undefined)}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] w-[480px] overflow-y-auto">
          {pending ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {pending.result.iconDataUrl ? (
                    <img src={pending.result.iconDataUrl} alt="" className="size-6 rounded" />
                  ) : null}
                  {t("sunsam.mcpb.configureTitle", { name: pending.result.displayName })}
                </DialogTitle>
                <DialogDescription>
                  {pending.result.description ?? t("sunsam.mcpb.configureDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {Object.entries(pending.result.userConfig).map(([key, field]) => {
                  const value = pending.values[key];
                  const label = `${field.title ?? key}${field.required ? " *" : ""}`;
                  return (
                    <div key={key} className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`sunsam-mcpb-${key}`}
                        className="text-ui-base text-foreground"
                      >
                        {label}
                      </label>
                      {field.type === "boolean" ? (
                        <Switch
                          id={`sunsam-mcpb-${key}`}
                          checked={value === true}
                          onCheckedChange={(checked) => setValue(key, checked)}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            className="min-w-0 flex-1"
                            id={`sunsam-mcpb-${key}`}
                            type={
                              field.sensitive
                                ? "password"
                                : field.type === "number"
                                  ? "number"
                                  : "text"
                            }
                            value={
                              Array.isArray(value)
                                ? value.join(", ")
                                : value === undefined
                                  ? ""
                                  : String(value)
                            }
                            placeholder={
                              field.type === "directory"
                                ? t("sunsam.mcpb.directoryPlaceholder")
                                : field.type === "file"
                                  ? t("sunsam.mcpb.filePlaceholder")
                                  : ""
                            }
                            onChange={(event) => {
                              const raw = event.target.value;
                              if (field.multiple) {
                                setValue(
                                  key,
                                  raw
                                    .split(",")
                                    .map((item) => item.trim())
                                    .filter(Boolean),
                                );
                              } else if (field.type === "number") {
                                setValue(key, raw === "" ? "" : Number(raw));
                              } else {
                                setValue(key, raw);
                              }
                            }}
                          />
                          {(field.type === "directory" || field.type === "file") &&
                          !field.multiple ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="lg"
                              onClick={() =>
                                void browse(
                                  key,
                                  field.type as "directory" | "file",
                                  String(value ?? ""),
                                )
                              }
                            >
                              <FolderOpen data-icon="inline-start" aria-hidden="true" />
                              {t("sunsam.mcpb.browse")}
                            </Button>
                          ) : null}
                        </div>
                      )}
                      {pending.result.detectedValues[key] !== undefined &&
                      pending.result.detectedValues[key] === value ? (
                        <p className="flex items-center gap-1 text-ui-sm text-foreground-subtle">
                          <Sparkles className="size-3" aria-hidden="true" />
                          {t("sunsam.mcpb.autoDetected")}
                        </p>
                      ) : null}
                      {field.description ? (
                        <p className="text-ui-sm text-foreground-subtle">{field.description}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={saving} onClick={closeCurrent}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={saving || missing.length > 0}
                  onClick={() => {
                    const current = pending;
                    setSaving(true);
                    void finish(current.result, current.values)
                      .then((ok) => {
                        if (ok) closeCurrent();
                      })
                      .finally(() => setSaving(false));
                  }}
                >
                  {t("sunsam.mcpb.save")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

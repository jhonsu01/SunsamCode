/**
 * Sunsam: verificación Authenticode de los instaladores de actualización en Windows.
 *
 * Upstream (3.17) exige el estado "Valid" de Get-AuthenticodeSignature. Los instaladores Sunsam van
 * firmados con un certificado propio que sólo es raíz de confianza en el equipo del autor: en el
 * resto el estado es UnknownError/NotTrusted aunque la firma esté intacta, y la actualización se
 * bloquearía. En lugar de quitar la comprobación se fija (pin) el certificado de Sunsam: se acepta
 * "Valid" como upstream, o una firma íntegra cuyo firmante sea exactamente el certificado Sunsam
 * (por huella SHA-1). Sin firma, con hash alterado o con otro firmante, se rechaza.
 */
import { execFile } from "node:child_process";
import { createWindowsPowerShellSecurityArgs } from "../../scripts/powershell-command.mjs";

/** Huellas SHA-1 de los certificados con los que se firman los instaladores Sunsam. */
export const SUNSAM_UPDATE_SIGNER_THUMBPRINTS: readonly string[] = [
  // CN=DevTest-JhonSupelano, válido 2026-08-16 → 2029-08-16 (E:\Dev\tools\devcert.cer).
  "CD6DD4166DDA675563A334959F62DEB03FCE00D5",
];

/** Valores de System.Management.Automation.SignatureStatus. */
const STATUS_VALID = 0;
const STATUS_UNKNOWN_ERROR = 1;
const STATUS_NOT_TRUSTED = 4;

export interface SunsamAuthenticodeSignature {
  status: number;
  subject?: string | null;
  thumbprint?: string | null;
}

/** null = aceptada; texto = motivo del rechazo. */
export function evaluateSunsamUpdateSignature(
  signature: SunsamAuthenticodeSignature,
  pinnedThumbprints: readonly string[] = SUNSAM_UPDATE_SIGNER_THUMBPRINTS,
): string | null {
  const subject = typeof signature.subject === "string" ? signature.subject.trim() : "";
  if (!subject) return "Windows update requires an Authenticode signature";
  if (signature.status === STATUS_VALID) return null;
  const thumbprint =
    typeof signature.thumbprint === "string" ? signature.thumbprint.trim().toUpperCase() : "";
  const pinned = pinnedThumbprints.map((value) => value.toUpperCase());
  // UnknownError/NotTrusted: la cadena termina en una raíz no confiable, pero el hash cuadra.
  // HashMismatch (3), NotSigned (2) y el resto nunca se aceptan.
  if (
    (signature.status === STATUS_UNKNOWN_ERROR || signature.status === STATUS_NOT_TRUSTED) &&
    thumbprint &&
    pinned.includes(thumbprint)
  ) {
    return null;
  }
  return `Windows update signature is not valid (status ${signature.status})`;
}

export async function readSunsamAuthenticodeSignature(
  filePath: string,
): Promise<SunsamAuthenticodeSignature> {
  const script = [
    "[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);",
    "$signature=Get-AuthenticodeSignature -LiteralPath $zcodeArg0;",
    "@{status=[int]$signature.Status;subject=$signature.SignerCertificate.Subject;thumbprint=$signature.SignerCertificate.Thumbprint}|ConvertTo-Json -Compress;",
  ].join("");
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile(
      "powershell.exe",
      createWindowsPowerShellSecurityArgs(script, [filePath]),
      { encoding: "utf8", timeout: 30_000, windowsHide: true },
      (error, output, stderr) => {
        if (error || stderr) reject(error ?? new Error(stderr));
        else resolve(output);
      },
    );
  });
  return JSON.parse(stdout.replace(/^\uFEFF/u, "").trim()) as SunsamAuthenticodeSignature;
}

/** Igual que verifyWindowsAuthenticodeSignature de upstream, con el certificado Sunsam fijado. */
export async function verifySunsamWindowsAuthenticodeSignature(
  filePath: string,
): Promise<string | null> {
  return evaluateSunsamUpdateSignature(await readSunsamAuthenticodeSignature(filePath));
}

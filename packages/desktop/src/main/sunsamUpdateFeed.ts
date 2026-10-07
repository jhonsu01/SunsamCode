/**
 * Sunsam: las actualizaciones de Sunsam Code salen SOLO de los GitHub Releases del fork.
 *
 * Upstream consulta el manifest de Z.ai (`/api/v1/releases/electron/manifest`), que distribuye el
 * ZCode oficial: aplicarlo a Sunsam Code reemplazaría la app por la oficial. Aquí se usa el
 * proveedor `github` de electron-updater contra jhonsu01/SunsamCode, que lee el `latest.yml`
 * publicado junto al instalador en cada release.
 *
 * Versionado: `<versión de upstream>-sunsam.<n>` (p. ej. 3.14.3-sunsam.7). Es semver válido y
 * ordena bien: sunsam.7 < sunsam.8 < 3.14.4-sunsam.1.
 */
import type { AppUpdater } from "electron-updater";

export const SUNSAM_UPDATE_REPOSITORY = { owner: "jhonsu01", repo: "SunsamCode" } as const;

export function applySunsamGithubUpdateProvider(
  updater: AppUpdater,
  logger: { info: (...args: unknown[]) => void },
): void {
  updater.setFeedURL({
    provider: "github",
    owner: SUNSAM_UPDATE_REPOSITORY.owner,
    repo: SUNSAM_UPDATE_REPOSITORY.repo,
    releaseType: "release",
  });
  // Las versiones Sunsam llevan sufijo "-sunsam.N" (semver prerelease). Con allowPrerelease el
  // GitHubProvider toma el release más nuevo cuyo tag es "-sunsam.*" y lee `sunsam.yml`, con
  // `latest.yml` como respaldo. No se fija `channel`: haría saltarse esos tags (y activaría
  // allowDowngrade).
  updater.allowPrerelease = true;
  updater.allowDowngrade = false;
  logger.info(
    `[auto-update] Sunsam GitHub provider applied repo=${SUNSAM_UPDATE_REPOSITORY.owner}/${SUNSAM_UPDATE_REPOSITORY.repo}`,
  );
}

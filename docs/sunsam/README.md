# Sunsam Code — capa de personalización

Sunsam Code es un fork de [zai-org/ZCode](https://github.com/zai-org/ZCode) con marca propia, sólo
_Custom providers_ y un router P2P (Sunsam Mesh). Toda la personalización vive en una **capa
aislada** para que las versiones nuevas de upstream se fusionen con el mínimo de conflictos.

## Qué cambia respecto a upstream

| Área                        | Dónde                                                                                               | Cómo se aplica                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Iconos (Win/Mac/Linux/Web)  | `branding/sunsam/` → `packages/desktop/build/**`, `packages/web/public/favicon.ico`                 | `python3 branding/sunsam/generate-icons.py` (idempotente)                                                            |
| Nombre de producto en la UI | `packages/shared/src/sunsamBrand.ts`, `packages/ui/src/sunsam/brand.ts`                             | Se reescribe "ZCode" → "Sunsam Code" en un único punto (i18n y menús nativos), sin tocar los ~200 textos de upstream |
| Logos de la UI              | `packages/ui/src/sunsam/`, `packages/ui/src/assets/sunsam/`                                         | `ZCodeAboutLogo.tsx` sólo reexporta la marca Sunsam                                                                  |
| Identidad del instalador    | `packages/desktop/scripts/desktop-product-identity.mjs`                                             | `appId dev.sunsam.code`, `Sunsam Code`, paquete Linux `sunsam-code`; se instala junto a ZCode oficial                |
| Datos de la app             | `packages/desktop/src/main/desktopRuntimeEnv.ts`                                                    | `userData` propio ("Sunsam Code"); `~/.zcode` se comparte con la CLI                                                 |
| Sólo Custom providers       | flag `SUNSAM_BRAND.hideBuiltinModelProviders`                                                       | Oculta Z.ai / Start Plan / Coding Plan en Model settings (reversible cambiando el flag)                              |
| Idioma español de la UI     | `packages/ui/src/sunsam/locales/es-ES.ts`, `SUPPORTED_LOCALES` en `packages/shared/src/protocol.ts` | Traducción completa; las claves nuevas de upstream sin traducir se muestran en inglés                                |
| Router P2P                  | `packages/sunsam-mesh/`                                                                             | Paquete nuevo, sin dependencias de upstream                                                                          |
| CI                          | `.github/workflows/sunsam-*.yml`                                                                    | Build multiplataforma y sincronización con upstream                                                                  |

Los ficheros de upstream tocados llevan comentarios `// Sunsam:` para localizarlos rápido
(`git grep -n "Sunsam:"`).

## Compilar

Local (el SO del host decide qué targets son posibles):

```bash
pnpm install
pnpm -r --filter "./packages/*" --filter "!@zcode/desktop" build
ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/ \
ZCODE_NODE_DIST_MIRROR=https://nodejs.org/dist \
ZCODE_ENV=production \
pnpm bundle:desktop -- --os linux --arch x64     # o --os win / --os mac, --arch arm64
```

Los instaladores quedan en `packages/desktop/dist/`
(`Sunsam Code-<versión>-<os>-<arch>.{exe,dmg,zip,AppImage,deb,rpm,pkg.tar.zst}`).

GitHub Actions (`.github/workflows/sunsam-desktop-build.yml`) compila **Windows x64, Linux
x64/arm64 y macOS arm64/x64** en cada push a `main`, en PRs y a mano (_Run workflow_). Al publicar
un tag `v*` crea un GitHub Release con todos los instaladores:

```bash
git tag v3.14.3-sunsam.1 && git push origin v3.14.3-sunsam.1
```

También se publica un Release en cualquier push (a `main` o a ramas `claude/**`) cuyo mensaje de
commit contenga `[release]`: el tag `v<versión>-sunsam.<n>` lo crea el propio workflow.

Los builds no están firmados. En macOS: `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"`.
En Windows, SmartScreen pedirá confirmación la primera vez.

## Mantenerse al día con upstream

`.github/workflows/sunsam-upstream-sync.yml` se ejecuta a diario (y a mano):

1. Añade `upstream = https://github.com/zai-org/ZCode.git` y trae `main`.
2. Si hay commits nuevos, los fusiona en `sync/upstream-<fecha>-<sha>` (merge normal, nunca rebase).
3. Los ficheros marcados `merge=ours` en `.gitattributes` (iconos, logo) conservan la versión Sunsam.
4. Regenera los iconos y abre un PR contra `main`; el build multiplataforma valida el PR.
5. Si hay conflictos, el PR los lista; se resuelven en esa rama y se fusiona cuando esté verde.

Para que el PR automático dispare el build, crea el secreto `SUNSAM_SYNC_TOKEN` (PAT con permisos
`contents` y `pull-requests`); con el `GITHUB_TOKEN` por defecto GitHub no lanza workflows en PRs
creados por otro workflow.

En local:

```bash
UPSTREAM_REF=main bash scripts/sunsam/sync-upstream.sh
```

Reglas para no perder la capa al actualizar:

- Código nuevo de Sunsam → directorios `sunsam/` o paquetes `@sunsam/*`, nunca dentro de lógica de upstream.
- Si hace falta tocar un fichero de upstream, cambio mínimo que llame a la capa Sunsam + comentario `// Sunsam:`.
- Textos nuevos → `SUNSAM_MESSAGES` en `packages/ui/src/sunsam/brand.ts`, no en `i18n/locales/*`.

## Página web (GitHub Pages) y README

- La página del proyecto es `docs/index.html` (ES/EN/中文, descargas leídas en vivo del último
  Release): <https://jhonsu01.github.io/SunsamCode/>.
- Si Pages publica "Deploy from a branch", elige la carpeta **`/docs`** para servir la página
  directamente; si eliges `/ (root)`, el `index.html` de la raíz redirige a `docs/`.
- Activación única: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Después,
  `.github/workflows/sunsam-pages.yml` la publica en cada push a `main` que toque `docs/` (o a mano
  con _Run workflow_).
- Web del repositorio: en la portada del repo, **About → ⚙ → Website** →
  `https://jhonsu01.github.io/SunsamCode/` (sustituye a `https://zcode.z.ai/` heredado del fork).
- README: `README.md` (español, principal), `README.en.md` (inglés) y `README.zh-CN.md` (chino).
  `README.md` y `README.en.md` usan `merge=ours` para que las actualizaciones de upstream no los pisen;
  la documentación original de ZCode se enlaza en su repositorio.

## Idiomas de la interfaz

La app incluye 中文, English y **Español** (Configuración → General → Idioma, o el menú de la barra
lateral). Con «Predeterminado del sistema», cualquier variante `es-*` del sistema abre en español.

Para añadir otro idioma (p. ej. `pt-BR`):

1. Añádelo a `SUPPORTED_LOCALES` en `packages/shared/src/protocol.ts` y a
   `resolveLocaleFromLanguageTag` si quieres detección automática.
2. Crea `packages/ui/src/sunsam/locales/<locale>.ts` con las mismas claves que
   `packages/ui/src/i18n/locales/en-US.ts` (las que falten se muestran en inglés) y regístralo en
   `MESSAGES` de `packages/ui/src/i18n/IntlProvider.tsx`.
3. `pnpm typecheck` señala cada tabla `Record<Locale, …>` que necesita la nueva entrada (menús
   nativos, `SUNSAM_MESSAGES`, etiquetas del selector); los servicios que sólo tienen zh/en reciben
   `toBaseLocale(locale)`.
4. `pnpm sunsam:test` comprueba que las claves y los `{placeholders}` coinciden con el inglés.

## Tests de la capa

```bash
pnpm sunsam:test
```

Ver también: [mejoras y hoja de ruta](mejoras.md) · [Sunsam Mesh](../../packages/sunsam-mesh/README.md).

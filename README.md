# Sunsam Code

<p align="center"><img src="public/logo/icons/512x512.png" alt="Sunsam Code" width="128" height="128" /></p>

**Agente de programación de escritorio con tus propios modelos y un router P2P entre máquinas.**

**Español** · [English](README.en.md) · [简体中文](README.zh-CN.md)

[![Release](https://img.shields.io/github/v/release/jhonsu01/SunsamCode?label=descargar&color=f4415e)](https://github.com/jhonsu01/SunsamCode/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/jhonsu01/SunsamCode/sunsam-desktop-build.yml?label=build)](https://github.com/jhonsu01/SunsamCode/actions/workflows/sunsam-desktop-build.yml)
[![Página](https://img.shields.io/badge/web-jhonsu01.github.io%2FSunsamCode-15121c)](https://jhonsu01.github.io/SunsamCode/)
[![Licencia](https://img.shields.io/badge/licencia-Apache--2.0-blue)](LICENSE)

Sunsam Code es un fork de [ZCode](https://github.com/zai-org/ZCode) (Z.ai) con marca propia,
configuración de modelos limitada a **Custom providers** y **Sunsam Mesh**, un router que reparte
cada petición entre un modelo pequeño local y modelos grandes en otras máquinas de tu red.

🌐 **Página del proyecto:** <https://jhonsu01.github.io/SunsamCode/>

## Descargas

Los instaladores están en **[Releases](https://github.com/jhonsu01/SunsamCode/releases/latest)**.

| Sistema | Arquitectura                        | Archivo                                     |
| ------- | ----------------------------------- | ------------------------------------------- |
| Windows | x64                                 | `Sunsam.Code-<versión>-win-x64.exe`         |
| macOS   | Apple Silicon (arm64) / Intel (x64) | `.dmg` o `.zip`                             |
| Linux   | x64 / arm64                         | `.AppImage`, `.deb`, `.rpm`, `.pkg.tar.zst` |

> Los instaladores **no están firmados**.
> **macOS:** tras copiar la app a Aplicaciones ejecuta
> `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"`.
> **Windows:** SmartScreen → _Más información_ → _Ejecutar de todas formas_.
> **Linux (AppImage):** `chmod +x Sunsam*.AppImage && ./Sunsam*.AppImage`.

Cada tag `v*` compila automáticamente Windows, macOS y Linux con GitHub Actions y publica el Release
([workflow](.github/workflows/sunsam-desktop-build.yml)).

## Qué cambia respecto a ZCode

|                             | ZCode                                            | Sunsam Code                                                                     |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Marca                       | ZCode                                            | Logo y nombre Sunsam en app, instaladores, menús y bandeja                      |
| Model settings              | Providers integrados (Z.ai, Start Plan) + Custom | **Sólo Custom providers** (LM Studio, Ollama, vLLM, Sunsam Mesh…)               |
| Enrutado de modelos         | Manual                                           | **Sunsam Mesh**: `sunsam-auto` decide entre modelo local y modelo grande en red |
| Instalación                 | `dev.zcode.app`                                  | `dev.sunsam.code`: se instala junto a ZCode sin sobrescribirlo                  |
| Actualizaciones de upstream | —                                                | Sincronización diaria con `zai-org/ZCode` conservando la capa Sunsam            |

## Sunsam Mesh: router P2P entre máquinas

```text
Sunsam Code ──▶ Sunsam Mesh (127.0.0.1:4141)
                   │  router: Laya (probabilidades calibradas) o heurística
                   ├── p_local ≥ 0.75 ─▶ tier local : SLM destilado (LM Studio / Ollama)
                   ├── p_local < 0.75 ─▶ tier swarm : modelo grande (vLLM, Petals, otros nodos)
                   └── en segundo plano: pares RLCD · destilación byte-level · etiquetas para Laya
```

```bash
pnpm sunsam:mesh:init   # crea ~/.sunsam/mesh.json (edita tus peers de la LAN)
pnpm sunsam:mesh        # arranca el gateway en http://127.0.0.1:4141
```

En la app: **Model settings → Add provider → Base URL `http://127.0.0.1:4141`** y elige el modelo
`sunsam-auto`, `sunsam-local` o `sunsam-swarm`. Detalles: [packages/sunsam-mesh](packages/sunsam-mesh/README.md).

Incluye dos técnicas del paper _Breaking the Token Ceiling_ (arXiv 2609.12303):

- **Conversión token→byte End-Of-Token**: destilación byte-level y etiquetas independientes del
  tokenizador para entrenar el router.
- **Bits-per-byte y bytes/s**: comparan modelos con tokenizadores distintos para elegir a qué máquina
  enviar cada petición.

## Compilar desde el código

Requisitos: Node.js 24.14.0 y pnpm 10.33.2 ([mise.toml](mise.toml)).

```bash
pnpm install
pnpm -r --filter "./packages/*" --filter "!@zcode/desktop" build
ZCODE_ENV=production \
ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/ \
ZCODE_NODE_DIST_MIRROR=https://nodejs.org/dist \
pnpm bundle:desktop -- --os linux --arch x64   # --os win | mac · --arch x64 | arm64
```

Los instaladores quedan en `packages/desktop/dist/`. Desarrollo: `pnpm dev:desktop` (escritorio) o
`pnpm dev:web` (web).

## Documentación

- [Capa de personalización, compilación y sincronización con upstream](docs/sunsam/README.md)
- [Mejoras y hoja de ruta (Laya, RLCD, P2P)](docs/sunsam/mejoras.md)
- [Sunsam Mesh](packages/sunsam-mesh/README.md) · [Especificación](packages/sunsam-mesh/SPEC.md)
- Documentación original de ZCode (funciones del agente, CLI, web): [README de upstream](https://github.com/zai-org/ZCode#readme)

## Licencia

Apache-2.0. Sunsam Code deriva de [ZCode](https://github.com/zai-org/ZCode) de Z.ai; ver
[LICENSE](LICENSE), [NOTICE.md](NOTICE.md) y [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

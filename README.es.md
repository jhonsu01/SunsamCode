# Sunsam Code

<p align="center"><img src="branding/sunsam/animated/sunsam-logo-animated-256.gif" alt="Sunsam Code" width="160" height="160" /></p>

<p align="center"><b>Un agente de programación de escritorio con tus propios modelos y un router P2P entre tus máquinas.</b></p>

<p align="center">
  <a href="README.md">English</a> · <b>Español</b> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/jhonsu01/SunsamCode/releases/latest"><img src="https://img.shields.io/github/v/release/jhonsu01/SunsamCode?label=download&color=f4415e" alt="Release" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/"><img src="https://img.shields.io/badge/web-jhonsu01.github.io%2FSunsamCode-15121c" alt="Website" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/documentation.html"><img src="https://img.shields.io/badge/docs-9%20languages-fdb673" alt="Documentation" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" /></a>
</p>

Sunsam Code es un fork de código abierto de [ZCode](https://github.com/zai-org/ZCode) (Z.ai) con marca propia, **proveedores de modelos personalizados** (el proveedor oficial de Z.ai sigue siendo opcional), **extensiones MCP en un clic** y **Sunsam Mesh**, un router que envía cada petición a un modelo local pequeño o a modelos grandes en otras máquinas de tu red.

🌐 **Web:** <https://jhonsu01.github.io/SunsamCode/> · 📖 **Documentación:** <https://jhonsu01.github.io/SunsamCode/documentation.html>

## Descargas

Los instaladores se publican en **[Releases](https://github.com/jhonsu01/SunsamCode/releases/latest)**.

| SO | Arquitectura | Archivo |
| ------- | ----------------------------------- | ------------------------------------------- |
| Windows | x64 | `Sunsam-Code-<version>-win-x64.exe` |
| macOS | Apple Silicon (arm64) / Intel (x64) | `.dmg` / `.zip` |
| Linux | x64 / arm64 | `.AppImage`, `.deb`, `.rpm`, `.pkg.tar.zst` |

> El **instalador de Windows está firmado** (Authenticode SHA-256 con sello de tiempo) con un certificado propio, no de una CA pública; macOS y Linux no están firmados.
> **Windows:** SmartScreen → _Más información_ → _Ejecutar de todas formas_.
> **macOS:** tras copiar la app a Aplicaciones ejecuta `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"`.
> **Linux (AppImage):** `chmod +x Sunsam*.AppImage && ./Sunsam*.AppImage`.

La app **se actualiza sola** desde estos Releases: en Windows y con la AppImage de Linux aparece el botón de actualizar (al iniciar, cada hora o en _Ayuda → Buscar actualizaciones_); en macOS descarga el nuevo `.dmg`.

## Novedades de 3.17.1-sunsam.1

- **Basado en ZCode 3.17.1**: sincronización de datos con dispositivos remotos (skills, MCP, plugins y ajustes de modelos), nuevo asistente de conexión remota para SSH, WSL y Docker que sigue conectando en segundo plano, gestión de proyectos, visores integrados de Word, PDF, PowerPoint y Excel, editor de imágenes, grupos de tareas, instrucciones personalizadas y búsqueda de herramientas. El control remoto del móvil se adaptó al nuevo protocolo de emparejamiento y sigue funcionando solo en tu red, sin cuenta de Z.ai. Toda la interfaz está traducida a los idiomas de Sunsam.
- **Los botones de copiar funcionan en el móvil**: en el control remoto, los iconos de copiar (tablas, código, mensajes) fallaban con «clipboard-unavailable» porque la página se sirve por HTTP en tu red; ahora copian directamente.
- **Control remoto desde el móvil sin servidores externos**: la app sirve la página móvil y el relay de emparejamiento en tu red local (el relay de Z.ai rechazaba las versiones Sunsam con «Not found»). Escanea el QR en la misma Wi-Fi; fuera de casa, instala Tailscale en los dos dispositivos.
- **Vuelven las actualizaciones automáticas**: el botón de actualizar aparece de nuevo cuando sale una versión y _Ayuda → Buscar actualizaciones_ indica si tienes la más reciente. La interfaz queda traducida por completo al español, portugués, francés, ruso y coreano.
- **Basado en ZCode 3.15.1**: UI Plugins (plugins con interfaz propia, como un flujo con Excalidraw), control remoto web desde el móvil, flujos de trabajo dinámicos y muchas correcciones, integrados sin perder ninguna función de Sunsam.
- **Logo de Sunsam animado** al iniciar y en la introducción (hecho con el conector EffectCraft y convertido a SVG + CSS); la marca de agua de inicio y el diálogo Acerca de muestran la marca Sunsam.
- **Documentación del producto** en 9 idiomas, desde _Ayuda → Documentación del producto_.
- **Informar de un problema** y **Solicitar una función** abren formularios de issue en GitHub con la versión y el sistema ya rellenados.

## Qué cambia respecto a ZCode

| | ZCode | Sunsam Code |
| --- | --- | --- |
| Marca | ZCode | Logo animado y nombre Sunsam en la app, instaladores, menús y bandeja |
| Modelos | Proveedores integrados (Z.ai, Start Plan) + Personalizado | **Proveedores personalizados** (LM Studio, Ollama, vLLM, Sunsam Mesh…) + Z.ai opcional |
| Enrutado de modelos | Manual | **Sunsam Mesh**: `sunsam-auto` elige entre un modelo local y uno grande |
| Identidad de instalación | `dev.zcode.app` | `dev.sunsam.code`: se instala junto a ZCode |
| Extensiones MCP | Servidores añadidos a mano | **Instala `.mcpb` / `.dxt`** con un botón, arrastrando o desde marketplaces |
| Actualizaciones | Servidor de Z.ai | **GitHub Releases** de este repositorio |
| Menú Ayuda | Documentación y formularios de Z.ai | **Documentación propia** e **issues de GitHub** |
| Idiomas | 中文, English | + Español, Português, Français, Русский, 한국어 |
| Esquemas de herramientas | Se envían tal cual | Adaptados a lo que acepta la API de Z.ai/GLM (evita el error `[1210]`) |

## Extensiones MCP (`.mcpb` / `.dxt`) y marketplaces

Sunsam Code instala extensiones empaquetadas en el formato [MCP Bundle](https://github.com/modelcontextprotocol/mcpb), el mismo de las _Extensiones_ de Claude Desktop.

1. Abre **Ajustes → Servidores MCP**.
2. Pulsa **Instalar extensión (.mcpb / .dxt)** o **arrastra** uno o varios archivos a la pantalla.
3. Las rutas de carpetas y programas que necesita se **detectan automáticamente**; **Examinar…** permite elegir otra.
4. Pulsa **Reiniciar ahora** para que el agente cargue la extensión.

Volver a subir el mismo paquete lo **actualiza** y conserva tu configuración; si el equipo no tiene Node.js se usa el que trae Sunsam Code. En **Ajustes → Servidores MCP → Marketplaces** el [marketplace de Sunsam](https://github.com/jhonsu01/marketplace-SunsamCode) instala conectores listos (FilmCraft, PhotoCraft, WordCraft, PdfCraft, DesignCraft, Audacity…) con un clic y muestra **Actualizar** cuando hay versión nueva.

## Sunsam Mesh: router P2P entre máquinas

```text
Sunsam Code ──▶ Sunsam Mesh (127.0.0.1:4141)
                   │  router: Laya (calibrated probabilities) or heuristic
                   ├── p_local ≥ 0.75 ─▶ local tier : distilled SLM (LM Studio / Ollama)
                   ├── p_local < 0.75 ─▶ swarm tier : large model (vLLM, Petals, other nodes)
                   └── in the background: RLCD pairs · byte-level distillation · Laya labels
```

```bash
pnpm sunsam:mesh:init   # ~/.sunsam/mesh.json
pnpm sunsam:mesh        # http://127.0.0.1:4141
```

En la app: **Ajustes de modelos → Añadir proveedor → URL base `http://127.0.0.1:4141`** y elige `sunsam-auto`, `sunsam-local` o `sunsam-swarm`. Detalles: [packages/sunsam-mesh](packages/sunsam-mesh/README.md).

## Informar problemas y proponer ideas

Usa **Ayuda → Informar de un problema** o **Ayuda → Solicitar una función** en la app, o abre un [issue](https://github.com/jhonsu01/SunsamCode/issues/new/choose). Las contribuciones son bienvenidas: abre un pull request contra `claude/nice-brown-v1jufb`.

## Ramas

| Rama | Propósito |
| --- | --- |
| `claude/nice-brown-v1jufb` | Desarrollo de Sunsam Code (de aquí salen los releases y la web) |
| `main` | Sincronizada con la rama de desarrollo |
| `zcode-upstream` | Espejo de [zai-org/ZCode](https://github.com/zai-org/ZCode) para integrar versiones nuevas |

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

Los instaladores quedan en `packages/desktop/dist/`. Desarrollo: `pnpm dev:desktop` (escritorio) o `pnpm dev:web` (web). Pruebas de Sunsam: `pnpm sunsam:test`.

## Documentación

- [Documentación del producto](https://jhonsu01.github.io/SunsamCode/documentation.html) (9 idiomas)
- [Capa de personalización, compilación y sincronización con upstream](docs/sunsam/README.md)
- [Mejoras y hoja de ruta: Laya, RLCD, P2P](docs/sunsam/mejoras.md)
- [Sunsam Mesh](packages/sunsam-mesh/README.md) · [Especificación](packages/sunsam-mesh/SPEC.md)
- Documentación original de ZCode: [README de upstream](https://github.com/zai-org/ZCode/blob/main/README.md)

## Licencia

Apache-2.0. Sunsam Code deriva de [ZCode](https://github.com/zai-org/ZCode) de Z.ai; ver [LICENSE](LICENSE), [NOTICE.md](NOTICE.md) y [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

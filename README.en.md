# Sunsam Code

<p align="center"><img src="public/logo/icons/512x512.png" alt="Sunsam Code" width="128" height="128" /></p>

**A desktop coding agent that runs on your own models, with a P2P router across your machines.**

[Español](README.md) · **English** · [简体中文](README.zh-CN.md)

[![Release](https://img.shields.io/github/v/release/jhonsu01/SunsamCode?label=download&color=f4415e)](https://github.com/jhonsu01/SunsamCode/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/jhonsu01/SunsamCode/sunsam-desktop-build.yml?label=build)](https://github.com/jhonsu01/SunsamCode/actions/workflows/sunsam-desktop-build.yml)
[![Website](https://img.shields.io/badge/web-jhonsu01.github.io%2FSunsamCode-15121c)](https://jhonsu01.github.io/SunsamCode/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

Sunsam Code is a fork of [ZCode](https://github.com/zai-org/ZCode) (Z.ai) with its own branding,
**Custom providers** (with the official Z.ai provider optional), and **Sunsam Mesh**, a router that sends each
request either to a small local model or to larger models on other machines in your network.

🌐 **Project page:** <https://jhonsu01.github.io/SunsamCode/>

## Downloads

Installers are published under **[Releases](https://github.com/jhonsu01/SunsamCode/releases/latest)**.

| OS      | Architecture                        | File                                        |
| ------- | ----------------------------------- | ------------------------------------------- |
| Windows | x64                                 | `Sunsam-Code-<version>-win-x64.exe`         |
| macOS   | Apple Silicon (arm64) / Intel (x64) | `.dmg` or `.zip`                            |
| Linux   | x64 / arm64                         | `.AppImage`, `.deb`, `.rpm`, `.pkg.tar.zst` |

> The **Windows installer is signed** (Authenticode SHA-256 with a timestamp) with the author's own
> certificate, not a public CA; macOS and Linux builds are not signed.
> **macOS:** after copying the app to Applications run
> `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"`.
> **Windows:** SmartScreen → _More info_ → _Run anyway_.
> **Linux (AppImage):** `chmod +x Sunsam*.AppImage && ./Sunsam*.AppImage`.

The app **updates itself** from these Releases: on Windows and with the Linux AppImage the update button
appears (on launch, every hour or via _Help → Check for updates_); on macOS download the new `.dmg`.
Windows is built and signed locally; macOS and Linux come from the [workflow](.github/workflows/sunsam-desktop-build.yml), run manually.

## What changes compared to ZCode

|                  | ZCode                                          | Sunsam Code                                                                             |
| ---------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Branding         | ZCode                                          | Sunsam logo and name in the app, installers, menus and tray                             |
| Model settings   | Built-in providers (Z.ai, Start Plan) + Custom | **Custom providers** (LM Studio, Ollama, vLLM, Sunsam Mesh…) + optional Z.ai            |
| Model routing    | Manual                                         | **Sunsam Mesh**: `sunsam-auto` picks between a local model and a large one              |
| Install identity | `dev.zcode.app`                                | `dev.sunsam.code`: installs side by side with ZCode                                     |
| Upstream updates | —                                              | Daily automatic sync with `zai-org/ZCode` that keeps the Sunsam layer                   |
| MCP extensions   | Servers added by hand (command, args, JSON)    | **Install `.mcpb` / `.dxt`** with a button or by dragging the file, like Claude Desktop |
| App updates      | Z.ai server (official ZCode)                   | **GitHub Releases** of this repository                                                  |
| Tool schemas     | Sent as-is                                     | Adapted to what the Z.ai/GLM API accepts (avoids error `[1210]`)                        |

## MCP extensions (`.mcpb` / `.dxt`)

Sunsam Code installs packaged extensions in the [MCP Bundle](https://github.com/modelcontextprotocol/mcpb) format,
the same one used by Claude Desktop _Extensions_ (`.mcpb`, and the older `.dxt`).

1. Open **Settings → MCP servers**.
2. Click **Install extension (.mcpb / .dxt)** or **drag** one or more files onto the screen.
3. If the extension needs settings (`user_config`), a form appears:
   - Folder and program paths are **detected automatically** (paths named by the extension, `PATH`,
     Program Files) and marked _Detected automatically_.
   - **Browse…** opens the system picker to choose another path by hand.
4. Click **Restart now** so the agent loads the extension.

| Action                               | Result                                                            |
| ------------------------------------ | ----------------------------------------------------------------- |
| Upload the same package again        | It is **updated** and keeps your settings                         |
| Delete the server from the list      | It is uninstalled and its files are removed                       |
| No Node.js installed on the computer | The Node bundled with Sunsam Code is used                         |
| The extension uses "tuple" schemas   | Adapted automatically so Z.ai/GLM does not reject the chat (1210) |

Extensions are stored in `%APPDATA%\Sunsam Code\extensions\` (macOS:
`~/Library/Application Support/Sunsam Code/extensions/`, Linux: `~/.config/Sunsam Code/extensions/`).

Tested with: [Audacity Bridge](https://github.com/jhonsu01/audacity-mcp-server/releases/latest), [Vector Magic Bridge](https://github.com/jhonsu01/VectorMagic-mcp-server/releases/latest),
[FilmCraft Bridge](https://github.com/jhonsu01/filmcraft-mcp-server/releases/latest) and Design Bridge (Adobe Illustrator).

## Sunsam Mesh: P2P router across machines

```text
Sunsam Code ──▶ Sunsam Mesh (127.0.0.1:4141)
                   │  router: Laya (calibrated probabilities) or heuristic
                   ├── p_local ≥ 0.75 ─▶ local tier : distilled SLM (LM Studio / Ollama)
                   ├── p_local < 0.75 ─▶ swarm tier : large model (vLLM, Petals, other nodes)
                   └── in the background: RLCD pairs · byte-level distillation · Laya labels
```

```bash
pnpm sunsam:mesh:init   # creates ~/.sunsam/mesh.json (edit your LAN peers)
pnpm sunsam:mesh        # starts the gateway at http://127.0.0.1:4141
```

In the app: **Model settings → Add provider → Base URL `http://127.0.0.1:4141`**, then pick
`sunsam-auto`, `sunsam-local` or `sunsam-swarm`. Details: [packages/sunsam-mesh](packages/sunsam-mesh/README.md).

It adopts two techniques from _Breaking the Token Ceiling_ (arXiv 2609.12303):

- **End-Of-Token token→byte conversion**: byte-level distillation data and tokenizer-independent
  labels to train the router.
- **Bits-per-byte and bytes/s**: compare models with different tokenizers to decide which machine
  should serve each request.

## Building from source

Requirements: Node.js 24.14.0 and pnpm 10.33.2 ([mise.toml](mise.toml)).

```bash
pnpm install
pnpm -r --filter "./packages/*" --filter "!@zcode/desktop" build
ZCODE_ENV=production \
ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/ \
ZCODE_NODE_DIST_MIRROR=https://nodejs.org/dist \
pnpm bundle:desktop -- --os linux --arch x64   # --os win | mac · --arch x64 | arm64
```

Installers are written to `packages/desktop/dist/`. Development: `pnpm dev:desktop` (desktop) or
`pnpm dev:web` (web).

## Documentation

- [Customization layer, builds and upstream sync (ES)](docs/sunsam/README.md)
- [Improvements and roadmap: Laya, RLCD, P2P (ES)](docs/sunsam/mejoras.md)
- [Sunsam Mesh](packages/sunsam-mesh/README.md) · [Specification](packages/sunsam-mesh/SPEC.md)
- Original ZCode documentation (agent features, CLI, web): [upstream README](https://github.com/zai-org/ZCode/blob/main/README.en.md)

## License

Apache-2.0. Sunsam Code is derived from [ZCode](https://github.com/zai-org/ZCode) by Z.ai; see
[LICENSE](LICENSE), [NOTICE.md](NOTICE.md) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

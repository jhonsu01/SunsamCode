# Sunsam Code

<p align="center"><img src="branding/sunsam/animated/sunsam-logo-animated-256.gif" alt="Sunsam Code" width="160" height="160" /></p>

<p align="center"><b>A desktop coding agent that runs on your own models, with a P2P router across your machines.</b></p>

<p align="center">
  <b>English</b> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/jhonsu01/SunsamCode/releases/latest"><img src="https://img.shields.io/github/v/release/jhonsu01/SunsamCode?label=download&color=f4415e" alt="Release" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/"><img src="https://img.shields.io/badge/web-jhonsu01.github.io%2FSunsamCode-15121c" alt="Website" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/documentation.html"><img src="https://img.shields.io/badge/docs-9%20languages-fdb673" alt="Documentation" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" /></a>
</p>

Sunsam Code is an open-source fork of [ZCode](https://github.com/zai-org/ZCode) (Z.ai) with its own branding,
**custom model providers** (the official Z.ai provider stays optional), **one-click MCP extensions** and
**Sunsam Mesh**, a router that sends each request to a small local model or to larger models on other machines
in your network.

🌐 **Website:** <https://jhonsu01.github.io/SunsamCode/> · 📖 **Documentation:** <https://jhonsu01.github.io/SunsamCode/documentation.html>

## Downloads

Installers are published under **[Releases](https://github.com/jhonsu01/SunsamCode/releases/latest)**.

| OS      | Architecture                        | File                                        |
| ------- | ----------------------------------- | ------------------------------------------- |
| Windows | x64                                 | `Sunsam-Code-<version>-win-x64.exe`         |
| macOS   | Apple Silicon (arm64) / Intel (x64) | `.dmg` or `.zip`                            |
| Linux   | x64 / arm64                         | `.AppImage`, `.deb`, `.rpm`, `.pkg.tar.zst` |

> The **Windows installer is signed** (Authenticode SHA-256 with a timestamp) with the author's own
> certificate, not a public CA; macOS and Linux builds are not signed.
> **Windows:** SmartScreen → _More info_ → _Run anyway_.
> **macOS:** after copying the app to Applications run
> `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"`.
> **Linux (AppImage):** `chmod +x Sunsam*.AppImage && ./Sunsam*.AppImage`.

The app **updates itself** from these Releases: on Windows and with the Linux AppImage the update button
appears (on launch, every hour or via _Help → Check for updates_); on macOS download the new `.dmg`.

## What's new in 3.17.1-sunsam.1

- **Based on ZCode 3.17.1**: data sync to remote devices (skills, MCP, plugins and model settings), a redesigned remote connection wizard for SSH, WSL and Docker that keeps connecting in the background, project management, built-in viewers for Word, PDF, PowerPoint and Excel, an image editor, task groups, custom instructions and tool search. Phone remote control was adapted to the new pairing protocol and still runs entirely on your network, without a Z.ai account. The whole interface is translated into the Sunsam languages.
- **Copy buttons work on the phone**: in remote control, the copy icons (tables, code, messages) failed with "clipboard-unavailable" because the page is served over HTTP on your network; they now copy directly.
- **Phone remote control without external servers**: the app now serves the mobile page and the pairing relay itself on your local network (the Z.ai relay rejected Sunsam builds with "Not found"). Scan the QR code on the same Wi-Fi; away from home, install Tailscale on both devices.
- **Automatic updates are back**: the update button appears again when a new version is out, and _Help → Check for updates_ tells you whether you are on the latest one. The UI is now fully translated into Spanish, Portuguese, French, Russian and Korean.
- **Based on ZCode 3.15.1**: UI Plugins (plugins with their own interface, such as an Excalidraw flow), web
  remote control from your phone, dynamic workflows and many fixes, merged without losing any Sunsam feature.
- **Animated Sunsam logo** at startup and in the introduction (made with the EffectCraft connector, rendered
  as SVG + CSS); the Z watermark on the home screen and the About dialog now show the Sunsam brand.
- **Product documentation** in 9 languages, opened from _Help → Product docs_.
- **Report an issue** and **Request a feature** open GitHub issue forms with the version and system filled in.

## What changes compared to ZCode

|                  | ZCode                                          | Sunsam Code                                                                             |
| ---------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Branding         | ZCode                                          | Animated Sunsam logo and name in the app, installers, menus and tray                    |
| Model settings   | Built-in providers (Z.ai, Start Plan) + Custom | **Custom providers** (LM Studio, Ollama, vLLM, Sunsam Mesh…) + optional Z.ai            |
| Model routing    | Manual                                         | **Sunsam Mesh**: `sunsam-auto` picks between a local model and a large one              |
| Install identity | `dev.zcode.app`                                | `dev.sunsam.code`: installs side by side with ZCode                                     |
| MCP extensions   | Servers added by hand (command, args, JSON)    | **Install `.mcpb` / `.dxt`** with a button, by dragging the file or from marketplaces   |
| App updates      | Z.ai server (official ZCode)                   | **GitHub Releases** of this repository                                                  |
| Help menu        | Z.ai docs and feedback forms                   | **Own documentation** and **GitHub issues**                                             |
| Languages        | 中文, English                                  | + Español, Português, Français, Русский, 한국어                                          |
| Tool schemas     | Sent as-is                                     | Adapted to what the Z.ai/GLM API accepts (avoids error `[1210]`)                        |

## MCP extensions (`.mcpb` / `.dxt`) and marketplaces

Sunsam Code installs packaged extensions in the [MCP Bundle](https://github.com/modelcontextprotocol/mcpb) format,
the same one used by Claude Desktop _Extensions_.

1. Open **Settings → MCP Servers**.
2. Click **Install extension (.mcpb / .dxt)** or **drag** one or more files onto the screen.
3. Folder and program paths the extension needs are **detected automatically**; **Browse…** picks another one.
4. Click **Restart now** so the agent loads the extension.

Uploading the same package again **updates** it and keeps your settings; without Node.js on the computer, the
Node bundled with Sunsam Code is used. Under **Settings → MCP Servers → Marketplaces** the
[Sunsam marketplace](https://github.com/jhonsu01/marketplace-SunsamCode) installs ready-made connectors (FilmCraft,
PhotoCraft, WordCraft, PdfCraft, DesignCraft, Audacity…) with one click and shows **Update** when a new version is out.

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

## Report problems and propose ideas

Use **Help → Report an issue** or **Help → Request a feature** in the app, or open an
[issue](https://github.com/jhonsu01/SunsamCode/issues/new/choose) directly. Contributions are welcome: open a pull
request against `claude/nice-brown-v1jufb`.

## Branches

| Branch                     | Purpose                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `claude/nice-brown-v1jufb` | Development of Sunsam Code (releases and website are built from here)    |
| `main`                     | Kept in sync with the development branch                                |
| `zcode-upstream`           | Mirror of [zai-org/ZCode](https://github.com/zai-org/ZCode) to merge new upstream versions |

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
`pnpm dev:web` (web). Sunsam tests: `pnpm sunsam:test`.

## Documentation

- [Product documentation](https://jhonsu01.github.io/SunsamCode/documentation.html) (9 languages)
- [Customization layer, builds and upstream sync (ES)](docs/sunsam/README.md)
- [Improvements and roadmap: Laya, RLCD, P2P (ES)](docs/sunsam/mejoras.md)
- [Sunsam Mesh](packages/sunsam-mesh/README.md) · [Specification](packages/sunsam-mesh/SPEC.md)
- Original ZCode documentation: [upstream README](https://github.com/zai-org/ZCode/blob/main/README.en.md)

## License

Apache-2.0. Sunsam Code is derived from [ZCode](https://github.com/zai-org/ZCode) by Z.ai; see
[LICENSE](LICENSE), [NOTICE.md](NOTICE.md) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

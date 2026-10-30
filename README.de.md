# Sunsam Code

<p align="center"><img src="branding/sunsam/animated/sunsam-logo-animated-256.gif" alt="Sunsam Code" width="160" height="160" /></p>

<p align="center"><b>Ein Desktop-Coding-Agent mit deinen eigenen Modellen und einem P2P-Router zwischen deinen Rechnern.</b></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <b>Deutsch</b> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/jhonsu01/SunsamCode/releases/latest"><img src="https://img.shields.io/github/v/release/jhonsu01/SunsamCode?label=download&color=f4415e" alt="Release" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/"><img src="https://img.shields.io/badge/web-jhonsu01.github.io%2FSunsamCode-15121c" alt="Website" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/documentation.html"><img src="https://img.shields.io/badge/docs-9%20languages-fdb673" alt="Documentation" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" /></a>
</p>

Sunsam Code ist ein Open-Source-Fork von [ZCode](https://github.com/zai-org/ZCode) (Z.ai) mit eigener Marke, **eigenen Modellanbietern** (der offizielle Z.ai-Anbieter bleibt optional), **MCP-Erweiterungen per Klick** und **Sunsam Mesh**, einem Router, der jede Anfrage an ein kleines lokales Modell oder an große Modelle auf anderen Rechnern im Netz schickt.

🌐 **Website:** <https://jhonsu01.github.io/SunsamCode/> · 📖 **Dokumentation:** <https://jhonsu01.github.io/SunsamCode/documentation.html>

## Downloads

Die Installationsprogramme erscheinen unter **[Releases](https://github.com/jhonsu01/SunsamCode/releases/latest)**.

| Betriebssystem | Architektur | Datei |
| ------- | ----------------------------------- | ------------------------------------------- |
| Windows | x64 | `Sunsam-Code-<version>-win-x64.exe` |
| macOS | Apple Silicon (arm64) / Intel (x64) | `.dmg` / `.zip` |
| Linux | x64 / arm64 | `.AppImage`, `.deb`, `.rpm`, `.pkg.tar.zst` |

> Das **Windows-Installationsprogramm ist signiert** (Authenticode SHA-256 mit Zeitstempel) – mit einem eigenen Zertifikat, nicht von einer öffentlichen CA; macOS und Linux sind nicht signiert.
> **Windows:** SmartScreen → _Weitere Informationen_ → _Trotzdem ausführen_.
> **macOS:** nach dem Kopieren nach Programme `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"` ausführen.
> **Linux (AppImage):** `chmod +x Sunsam*.AppImage && ./Sunsam*.AppImage`.

Die App **aktualisiert sich selbst** aus diesen Releases: unter Windows und mit dem Linux-AppImage erscheint die Update-Schaltfläche (beim Start, stündlich oder über _Help → Check for updates_); unter macOS das neue `.dmg` herunterladen.

## Neu in 3.17.1-sunsam.1

- **Basiert auf ZCode 3.17.1**: Datensynchronisierung mit Remote-Geräten (Skills, MCP, Plugins und Modelleinstellungen), ein neuer Assistent für SSH-, WSL- und Docker-Verbindungen, der im Hintergrund weiterverbindet, Projektverwaltung, integrierte Viewer für Word, PDF, PowerPoint und Excel, ein Bildeditor, Aufgabengruppen, eigene Anweisungen und Tool-Suche. Die Handy-Fernsteuerung wurde an das neue Kopplungsprotokoll angepasst und läuft weiterhin nur in Ihrem Netz, ohne Z.ai-Konto. Die gesamte Oberfläche ist in die Sunsam-Sprachen übersetzt.
- **Kopier-Schaltflächen funktionieren auf dem Handy**: In der Fernsteuerung schlugen die Kopiersymbole (Tabellen, Code, Nachrichten) mit „clipboard-unavailable“ fehl, weil die Seite per HTTP im lokalen Netz ausgeliefert wird; jetzt kopieren sie direkt.
- **Fernsteuerung per Handy ohne externe Server**: Die App liefert die mobile Seite und das Kopplungs-Relay selbst im lokalen Netz aus (das Z.ai-Relay lehnte Sunsam-Versionen mit „Not found“ ab). QR-Code im selben WLAN scannen; unterwegs Tailscale auf beiden Geräten installieren.
- **Automatische Updates sind zurück**: Die Update-Schaltfläche erscheint wieder, sobald eine neue Version vorliegt, und _Hilfe → Nach Updates suchen_ zeigt, ob Sie die neueste haben. Die Oberfläche ist jetzt vollständig ins Spanische, Portugiesische, Französische, Russische und Koreanische übersetzt.
- **Basiert auf ZCode 3.15.1**: UI Plugins (Plugins mit eigener Oberfläche, etwa ein Excalidraw-Workflow), Web-Fernsteuerung vom Handy, dynamische Workflows und viele Korrekturen – ohne eine Sunsam-Funktion zu verlieren.
- **Animiertes Sunsam-Logo** beim Start und in der Einführung (mit dem EffectCraft-Connector erstellt, als SVG + CSS umgesetzt); Wasserzeichen auf dem Startbildschirm und Info-Dialog zeigen die Sunsam-Marke.
- **Produktdokumentation** in 9 Sprachen, über _Help → Product docs_.
- **Report an issue** und **Request a feature** öffnen GitHub-Issue-Formulare mit vorausgefüllter Version und System.

## Was sich gegenüber ZCode ändert

| | ZCode | Sunsam Code |
| --- | --- | --- |
| Marke | ZCode | Animiertes Sunsam-Logo und -Name in App, Installern, Menüs und Tray |
| Modelle | Integrierte Anbieter (Z.ai, Start Plan) + Benutzerdefiniert | **Eigene Anbieter** (LM Studio, Ollama, vLLM, Sunsam Mesh…) + optional Z.ai |
| Modell-Routing | Manuell | **Sunsam Mesh**: `sunsam-auto` wählt zwischen lokalem und großem Modell |
| Installationsidentität | `dev.zcode.app` | `dev.sunsam.code`: parallel zu ZCode installierbar |
| MCP-Erweiterungen | Server von Hand hinzufügen | **`.mcpb` / `.dxt` installieren** per Klick, Drag & Drop oder aus Marketplaces |
| Updates | Z.ai-Server | **GitHub Releases** dieses Repositorys |
| Hilfe-Menü | Z.ai-Dokumentation und -Formulare | **Eigene Dokumentation** und **GitHub-Issues** |
| Sprachen | 中文, English | + Español, Português, Français, Русский, 한국어 |
| Tool-Schemas | Unverändert gesendet | An die Z.ai/GLM-API angepasst (vermeidet Fehler `[1210]`) |

## MCP-Erweiterungen (`.mcpb` / `.dxt`) und Marketplaces

Sunsam Code installiert Erweiterungen im Format [MCP Bundle](https://github.com/modelcontextprotocol/mcpb), wie die _Extensions_ von Claude Desktop.

1. **Settings → MCP Servers** öffnen.
2. **Install extension (.mcpb / .dxt)** klicken oder Dateien in das Fenster **ziehen**.
3. Benötigte Ordner- und Programmpfade werden **automatisch erkannt**; **Browse…** wählt einen anderen.
4. **Restart now** klicken, damit der Agent die Erweiterung lädt.

Dasselbe Paket erneut hochladen **aktualisiert** es und behält die Einstellungen; ohne Node.js wird das mitgelieferte verwendet. Unter **Settings → MCP Servers → Marketplaces** installiert der [Sunsam-Marketplace](https://github.com/jhonsu01/marketplace-SunsamCode) fertige Connectors (FilmCraft, PhotoCraft, WordCraft, PdfCraft, DesignCraft, Audacity…) per Klick und zeigt **Update**, sobald eine neue Version erscheint.

## Sunsam Mesh: P2P-Router zwischen Rechnern

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

In der App: **Model settings → Add provider → Basis-URL `http://127.0.0.1:4141`**, dann `sunsam-auto`, `sunsam-local` oder `sunsam-swarm` wählen. Details: [packages/sunsam-mesh](packages/sunsam-mesh/README.md).

## Probleme melden und Ideen vorschlagen

Nutze **Help → Report an issue** oder **Help → Request a feature** in der App oder öffne direkt ein [Issue](https://github.com/jhonsu01/SunsamCode/issues/new/choose). Beiträge sind willkommen: Pull Requests gegen `claude/nice-brown-v1jufb`.

## Branches

| Branch | Zweck |
| --- | --- |
| `claude/nice-brown-v1jufb` | Entwicklung von Sunsam Code (Releases und Website entstehen hier) |
| `main` | Mit dem Entwicklungsbranch synchron |
| `zcode-upstream` | Spiegel von [zai-org/ZCode](https://github.com/zai-org/ZCode) zum Einpflegen neuer Versionen |

## Aus dem Quellcode bauen

Voraussetzungen: Node.js 24.14.0 und pnpm 10.33.2 ([mise.toml](mise.toml)).

```bash
pnpm install
pnpm -r --filter "./packages/*" --filter "!@zcode/desktop" build
ZCODE_ENV=production \
ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/ \
ZCODE_NODE_DIST_MIRROR=https://nodejs.org/dist \
pnpm bundle:desktop -- --os linux --arch x64   # --os win | mac · --arch x64 | arm64
```

Die Installationsprogramme landen in `packages/desktop/dist/`. Entwicklung: `pnpm dev:desktop` (Desktop) oder `pnpm dev:web` (Web). Sunsam-Tests: `pnpm sunsam:test`.

## Dokumentation

- [Produktdokumentation](https://jhonsu01.github.io/SunsamCode/documentation.html) (9 Sprachen)
- [Anpassungsschicht, Builds und Upstream-Sync (ES)](docs/sunsam/README.md)
- [Verbesserungen und Roadmap: Laya, RLCD, P2P (ES)](docs/sunsam/mejoras.md)
- [Sunsam Mesh](packages/sunsam-mesh/README.md) · [Spezifikation](packages/sunsam-mesh/SPEC.md)
- Originale ZCode-Dokumentation: [Upstream-README](https://github.com/zai-org/ZCode/blob/main/README.en.md)

## Lizenz

Apache-2.0. Sunsam Code basiert auf [ZCode](https://github.com/zai-org/ZCode) von Z.ai; siehe [LICENSE](LICENSE), [NOTICE.md](NOTICE.md) und [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

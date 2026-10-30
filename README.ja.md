# Sunsam Code

<p align="center"><img src="branding/sunsam/animated/sunsam-logo-animated-256.gif" alt="Sunsam Code" width="160" height="160" /></p>

<p align="center"><b>自分のモデルで動き、手元のマシン間を P2P でルーティングするデスクトップのコーディングエージェント。</b></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <b>日本語</b> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/jhonsu01/SunsamCode/releases/latest"><img src="https://img.shields.io/github/v/release/jhonsu01/SunsamCode?label=download&color=f4415e" alt="Release" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/"><img src="https://img.shields.io/badge/web-jhonsu01.github.io%2FSunsamCode-15121c" alt="Website" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/documentation.html"><img src="https://img.shields.io/badge/docs-9%20languages-fdb673" alt="Documentation" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" /></a>
</p>

Sunsam Code は [ZCode](https://github.com/zai-org/ZCode)（Z.ai）のオープンソースのフォークです。独自ブランド、**カスタムモデルプロバイダー**（Z.ai 公式プロバイダーは任意）、**ワンクリックの MCP 拡張機能**、そして各リクエストをローカルの小さなモデルかネットワーク上の別マシンの大きなモデルに振り分ける **Sunsam Mesh** を備えています。

🌐 **Web サイト:** <https://jhonsu01.github.io/SunsamCode/> · 📖 **ドキュメント:** <https://jhonsu01.github.io/SunsamCode/documentation.html>

## ダウンロード

インストーラーは **[Releases](https://github.com/jhonsu01/SunsamCode/releases/latest)** で公開しています。

| OS | アーキテクチャ | ファイル |
| ------- | ----------------------------------- | ------------------------------------------- |
| Windows | x64 | `Sunsam-Code-<version>-win-x64.exe` |
| macOS | Apple Silicon (arm64) / Intel (x64) | `.dmg` / `.zip` |
| Linux | x64 / arm64 | `.AppImage`, `.deb`, `.rpm`, `.pkg.tar.zst` |

> **Windows インストーラーは署名済み**（タイムスタンプ付き Authenticode SHA-256）ですが、公的 CA ではなく作者自身の証明書です。macOS と Linux は未署名です。
> **Windows：** SmartScreen → _詳細情報_ → _実行_。
> **macOS：** アプリケーションにコピーした後 `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"` を実行します。
> **Linux（AppImage）：** `chmod +x Sunsam*.AppImage && ./Sunsam*.AppImage`。

アプリはこれらの Releases から**自動更新**されます。Windows と Linux の AppImage では更新ボタンが表示されます（起動時、1 時間ごと、または _Help → Check for updates_）。macOS では新しい `.dmg` をダウンロードしてください。

## 3.17.1-sunsam.1 の新機能

- **ZCode 3.17.1 ベース**: リモート端末へのデータ同期（スキル、MCP、プラグイン、モデル設定）、バックグラウンドで接続を続ける SSH・WSL・Docker の新しいリモート接続ウィザード、プロジェクト管理、Word・PDF・PowerPoint・Excel の内蔵ビューア、画像エディタ、タスクグループ、カスタム指示、ツール検索。スマホからの遠隔操作は新しいペアリング方式に対応し、Z.ai アカウントなしで引き続き自分のネットワーク内だけで動作します。UI 全体が Sunsam の各言語に翻訳されています。
- **スマホでコピーボタンが使えるように**: 遠隔操作のコピーアイコン（表・コード・メッセージ）は、ページがローカルネットワークで HTTP 配信されるため「clipboard-unavailable」で失敗していましたが、直接コピーできるようになりました。
- **外部サーバーなしのスマホ遠隔操作**: アプリ自身がローカルネットワークでモバイルページとペアリング用リレーを提供します（Z.ai のリレーは Sunsam 版を「Not found」で拒否していました）。同じ Wi-Fi で QR を読み取り、外出先では両方の端末に Tailscale を入れてください。
- **自動更新が復活**: 新しいバージョンが出ると更新ボタンが再び表示され、_ヘルプ → 更新を確認_ で最新かどうかが分かります。UI はスペイン語、ポルトガル語、フランス語、ロシア語、韓国語に完全翻訳されました。
- **ZCode 3.15.1 ベース**：UI Plugins（Excalidraw のワークフローなど独自 UI を持つプラグイン）、スマートフォンからの Web リモートコントロール、動的ワークフロー、多数の修正を、Sunsam の機能を失わずに統合。
- 起動時とイントロに **Sunsam のアニメーションロゴ**（EffectCraft コネクターで作成し SVG + CSS で実装）。ホームの透かしと About ダイアログも Sunsam ブランドに。
- **製品ドキュメント**を 9 言語で用意し、_Help → Product docs_ から開けます。
- **Report an issue** と **Request a feature** は、バージョンと OS が入力済みの GitHub issue フォームを開きます。

## ZCode との違い

| | ZCode | Sunsam Code |
| --- | --- | --- |
| ブランド | ZCode | アプリ、インストーラー、メニュー、トレイに Sunsam のアニメーションロゴと名前 |
| モデル | 組み込みプロバイダー（Z.ai、Start Plan）+ カスタム | **カスタムプロバイダー**（LM Studio、Ollama、vLLM、Sunsam Mesh…）+ 任意の Z.ai |
| モデルのルーティング | 手動 | **Sunsam Mesh**：`sunsam-auto` がローカルと大きなモデルを選択 |
| インストール ID | `dev.zcode.app` | `dev.sunsam.code`：ZCode と共存可能 |
| MCP 拡張機能 | サーバーを手動で追加 | ボタン、ドラッグ、マーケットプレイスから **`.mcpb` / `.dxt` をインストール** |
| アプリの更新 | Z.ai のサーバー | このリポジトリの **GitHub Releases** |
| ヘルプメニュー | Z.ai のドキュメントとフォーム | **独自ドキュメント**と **GitHub issues** |
| 言語 | 中文, English | + Español, Português, Français, Русский, 한국어 |
| ツールのスキーマ | そのまま送信 | Z.ai/GLM API が受け付ける形式に変換（エラー `[1210]` を回避） |

## MCP 拡張機能（`.mcpb` / `.dxt`）とマーケットプレイス

Sunsam Code は Claude Desktop の _Extensions_ と同じ [MCP Bundle](https://github.com/modelcontextprotocol/mcpb) 形式の拡張機能をインストールできます。

1. **Settings → MCP Servers** を開きます。
2. **Install extension (.mcpb / .dxt)** をクリックするか、ファイルを画面に**ドラッグ**します。
3. 必要なフォルダーやプログラムのパスは**自動検出**され、**Browse…** で変更できます。
4. **Restart now** をクリックすると、エージェントが拡張機能を読み込みます。

同じパッケージを再度アップロードすると設定を保ったまま**更新**されます。Node.js が無い環境では Sunsam Code 同梱の Node を使います。**Settings → MCP Servers → Marketplaces** の [Sunsam マーケットプレイス](https://github.com/jhonsu01/marketplace-SunsamCode) から、既製のコネクター（FilmCraft、PhotoCraft、WordCraft、PdfCraft、DesignCraft、Audacity…）をワンクリックでインストールでき、新版があると **Update** が表示されます。

## Sunsam Mesh：マシン間の P2P ルーター

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

アプリで **Model settings → Add provider → ベース URL `http://127.0.0.1:4141`** を設定し、`sunsam-auto`・`sunsam-local`・`sunsam-swarm` を選びます。詳細：[packages/sunsam-mesh](packages/sunsam-mesh/README.md)。

## 問題の報告とアイデアの提案

アプリの **Help → Report an issue** または **Help → Request a feature** を使うか、直接 [issue](https://github.com/jhonsu01/SunsamCode/issues/new/choose) を作成してください。貢献も歓迎します。`claude/nice-brown-v1jufb` に pull request を送ってください。

## ブランチ

| ブランチ | 用途 |
| --- | --- |
| `claude/nice-brown-v1jufb` | Sunsam Code の開発（リリースと Web サイトはここから作成） |
| `main` | 開発ブランチと同期 |
| `zcode-upstream` | 新しいバージョンを取り込むための [zai-org/ZCode](https://github.com/zai-org/ZCode) のミラー |

## ソースからビルド

必要なもの：Node.js 24.14.0 と pnpm 10.33.2（[mise.toml](mise.toml)）。

```bash
pnpm install
pnpm -r --filter "./packages/*" --filter "!@zcode/desktop" build
ZCODE_ENV=production \
ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/ \
ZCODE_NODE_DIST_MIRROR=https://nodejs.org/dist \
pnpm bundle:desktop -- --os linux --arch x64   # --os win | mac · --arch x64 | arm64
```

インストーラーは `packages/desktop/dist/` に出力されます。開発：`pnpm dev:desktop`（デスクトップ）または `pnpm dev:web`（Web）。Sunsam のテスト：`pnpm sunsam:test`。

## ドキュメント

- [製品ドキュメント](https://jhonsu01.github.io/SunsamCode/documentation.html)（9 言語）
- [カスタマイズ層、ビルド、upstream との同期（スペイン語）](docs/sunsam/README.md)
- [改善とロードマップ：Laya、RLCD、P2P（スペイン語）](docs/sunsam/mejoras.md)
- [Sunsam Mesh](packages/sunsam-mesh/README.md) · [仕様](packages/sunsam-mesh/SPEC.md)
- ZCode のオリジナルドキュメント：[upstream の README](https://github.com/zai-org/ZCode/blob/main/README.en.md)

## ライセンス

Apache-2.0。Sunsam Code は Z.ai の [ZCode](https://github.com/zai-org/ZCode) から派生しています。[LICENSE](LICENSE)、[NOTICE.md](NOTICE.md)、[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) を参照してください。

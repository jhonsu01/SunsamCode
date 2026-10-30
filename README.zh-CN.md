# Sunsam Code

<p align="center"><img src="branding/sunsam/animated/sunsam-logo-animated-256.gif" alt="Sunsam Code" width="160" height="160" /></p>

<p align="center"><b>使用你自己的模型、并在你的多台机器之间进行 P2P 路由的桌面编程智能体。</b></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <b>简体中文</b> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/jhonsu01/SunsamCode/releases/latest"><img src="https://img.shields.io/github/v/release/jhonsu01/SunsamCode?label=download&color=f4415e" alt="Release" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/"><img src="https://img.shields.io/badge/web-jhonsu01.github.io%2FSunsamCode-15121c" alt="Website" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/documentation.html"><img src="https://img.shields.io/badge/docs-9%20languages-fdb673" alt="Documentation" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" /></a>
</p>

Sunsam Code 是 [ZCode](https://github.com/zai-org/ZCode)（Z.ai）的开源分支，拥有自己的品牌、**自定义模型供应商**（Z.ai 官方供应商仍可选）、**一键安装的 MCP 扩展**，以及 **Sunsam Mesh**——把每个请求分配给本地小模型或局域网中其他机器上大模型的路由器。

🌐 **官网:** <https://jhonsu01.github.io/SunsamCode/> · 📖 **文档:** <https://jhonsu01.github.io/SunsamCode/documentation.html>

## 下载

安装包发布在 **[Releases](https://github.com/jhonsu01/SunsamCode/releases/latest)**。

| 系统 | 架构 | 文件 |
| ------- | ----------------------------------- | ------------------------------------------- |
| Windows | x64 | `Sunsam-Code-<version>-win-x64.exe` |
| macOS | Apple Silicon (arm64) / Intel (x64) | `.dmg` / `.zip` |
| Linux | x64 / arm64 | `.AppImage`, `.deb`, `.rpm`, `.pkg.tar.zst` |

> **Windows 安装包已签名**（Authenticode SHA-256，带时间戳），使用作者自有证书而非公共 CA；macOS 与 Linux 未签名。
> **Windows：** SmartScreen → _更多信息_ → _仍要运行_。
> **macOS：** 复制到“应用程序”后运行 `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"`。
> **Linux（AppImage）：** `chmod +x Sunsam*.AppImage && ./Sunsam*.AppImage`。

应用会从这些 Releases **自动更新**：在 Windows 和 Linux AppImage 上会出现更新按钮（启动时、每小时或通过 _帮助 → 检查更新_）；macOS 请下载新的 `.dmg`。

## 3.17.1-sunsam.1 新内容

- **基于 ZCode 3.17.1**：向远程设备同步数据（技能、MCP、插件和模型设置）、可在后台继续连接的全新 SSH / WSL / Docker 远程连接向导、项目管理、内置 Word / PDF / PowerPoint / Excel 查看器、图片编辑器、任务分组、自定义指令和工具搜索。手机远程控制已适配新的配对协议，仍然只在你的网络内运行，无需 Z.ai 账号。整个界面已翻译为 Sunsam 支持的语言。
- **手机上的复制按钮可用了**：远程控制中的复制图标（表格、代码、消息）因页面在局域网内通过 HTTP 提供而报 “clipboard-unavailable”，现在可以直接复制。
- **无需外部服务器的手机远程控制**：应用直接在局域网内提供移动页面和配对中继（Z.ai 的中继会以 “Not found” 拒绝 Sunsam 版本）。在同一 Wi-Fi 下扫码；在外面时，请在两台设备上安装 Tailscale。
- **自动更新回归**：有新版本时更新按钮会重新出现，_帮助 → 检查更新_ 会告诉你是否已是最新版本。界面已完整翻译为西班牙语、葡萄牙语、法语、俄语和韩语。
- **基于 ZCode 3.15.1**：UI Plugins（拥有自己界面的插件，如 Excalidraw 工作流）、手机 Web 远程控制、动态工作流和大量修复，且未丢失任何 Sunsam 功能。
- 启动与引导中的 **Sunsam 动画 Logo**（使用 EffectCraft 连接器制作，以 SVG + CSS 实现）；首页水印和“关于”对话框改为 Sunsam 品牌。
- **产品文档**支持 9 种语言，可从 _帮助 → 产品文档_ 打开。
- **问题上报**与**给产品提需求**会打开 GitHub issue 表单，并预填版本与系统。

## 与 ZCode 的区别

| | ZCode | Sunsam Code |
| --- | --- | --- |
| 品牌 | ZCode | 应用、安装包、菜单和托盘中的 Sunsam 动画 Logo 与名称 |
| 模型 | 内置供应商（Z.ai、Start Plan）+ 自定义 | **自定义供应商**（LM Studio、Ollama、vLLM、Sunsam Mesh…）+ 可选 Z.ai |
| 模型路由 | 手动 | **Sunsam Mesh**：`sunsam-auto` 在本地模型和大模型之间选择 |
| 安装标识 | `dev.zcode.app` | `dev.sunsam.code`：可与 ZCode 并存 |
| MCP 扩展 | 手动添加服务器 | 按钮、拖拽或从市场**安装 `.mcpb` / `.dxt`** |
| 应用更新 | Z.ai 服务器 | 本仓库的 **GitHub Releases** |
| 帮助菜单 | Z.ai 文档与反馈表单 | **自有文档**与 **GitHub issues** |
| 语言 | 中文, English | + Español, Português, Français, Русский, 한국어 |
| 工具 schema | 原样发送 | 适配 Z.ai/GLM API 可接受的格式（避免 `[1210]` 错误） |

## MCP 扩展（`.mcpb` / `.dxt`）与插件市场

Sunsam Code 可安装 [MCP Bundle](https://github.com/modelcontextprotocol/mcpb) 格式的扩展，与 Claude Desktop 的“扩展”相同。

1. 打开 **设置 → MCP 服务器**。
2. 点击 **安装扩展（.mcpb / .dxt）** 或把一个或多个文件**拖到**窗口中。
3. 扩展所需的文件夹和程序路径会**自动检测**；点击 **浏览…** 可另选。
4. 点击 **立即重启** 让智能体加载扩展。

再次上传同一个包会**更新**它并保留设置；电脑上没有 Node.js 时使用 Sunsam Code 自带的 Node。在 **设置 → MCP 服务器 → 插件市场** 中，[Sunsam 市场](https://github.com/jhonsu01/marketplace-SunsamCode) 可一键安装现成的连接器（FilmCraft、PhotoCraft、WordCraft、PdfCraft、DesignCraft、Audacity…），有新版本时显示**更新**。

## Sunsam Mesh：多机 P2P 路由

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

在应用中：**模型设置 → 添加供应商 → Base URL `http://127.0.0.1:4141`**，然后选择 `sunsam-auto`、`sunsam-local` 或 `sunsam-swarm`。详见 [packages/sunsam-mesh](packages/sunsam-mesh/README.md)。

## 报告问题与提出建议

在应用中使用 **帮助 → 问题上报** 或 **帮助 → 给产品提需求**，或直接创建 [issue](https://github.com/jhonsu01/SunsamCode/issues/new/choose)。欢迎贡献：向 `claude/nice-brown-v1jufb` 提交 pull request。

## 分支

| 分支 | 用途 |
| --- | --- |
| `claude/nice-brown-v1jufb` | Sunsam Code 开发分支（发布版本与官网由此构建） |
| `main` | 与开发分支保持同步 |
| `zcode-upstream` | [zai-org/ZCode](https://github.com/zai-org/ZCode) 的镜像，用于合并上游新版本 |

## 从源码构建

要求：Node.js 24.14.0 与 pnpm 10.33.2（[mise.toml](mise.toml)）。

```bash
pnpm install
pnpm -r --filter "./packages/*" --filter "!@zcode/desktop" build
ZCODE_ENV=production \
ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/ \
ZCODE_NODE_DIST_MIRROR=https://nodejs.org/dist \
pnpm bundle:desktop -- --os linux --arch x64   # --os win | mac · --arch x64 | arm64
```

安装包输出到 `packages/desktop/dist/`。开发：`pnpm dev:desktop`（桌面端）或 `pnpm dev:web`（Web）。Sunsam 测试：`pnpm sunsam:test`。

## 文档

- [产品文档](https://jhonsu01.github.io/SunsamCode/documentation.html)（9 种语言）
- [定制层、构建与上游同步（西班牙语）](docs/sunsam/README.md)
- [改进与路线图：Laya、RLCD、P2P（西班牙语）](docs/sunsam/mejoras.md)
- [Sunsam Mesh](packages/sunsam-mesh/README.md) · [规范](packages/sunsam-mesh/SPEC.md)
- ZCode 原始文档：[上游 README](https://github.com/zai-org/ZCode/blob/main/README.md)

## 许可证

Apache-2.0。Sunsam Code 源自 Z.ai 的 [ZCode](https://github.com/zai-org/ZCode)；参见 [LICENSE](LICENSE)、[NOTICE.md](NOTICE.md) 和 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

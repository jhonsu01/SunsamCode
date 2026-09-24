# Sunsam Code

<div align="center">
  <img src="public/logo/icons/512x512.png" alt="Sunsam Code" width="128" height="128" />

**使用你自己的模型、并在多台机器之间进行 P2P 路由的桌面编程智能体。**

[Español](README.md) · [English](README.en.md) · **简体中文**

[![Release](https://img.shields.io/github/v/release/jhonsu01/SunsamCode?label=下载&color=f4415e)](https://github.com/jhonsu01/SunsamCode/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/jhonsu01/SunsamCode/sunsam-desktop-build.yml?label=build)](https://github.com/jhonsu01/SunsamCode/actions/workflows/sunsam-desktop-build.yml)
[![网站](https://img.shields.io/badge/web-jhonsu01.github.io%2FSunsamCode-15121c)](https://jhonsu01.github.io/SunsamCode/)
[![许可证](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

</div>

Sunsam Code 是 [ZCode](https://github.com/zai-org/ZCode)（Z.ai）的分支：使用 Sunsam 品牌，模型设置只保留
**自定义供应商**，并提供 **Sunsam Mesh**——把每个请求路由到本地小模型或局域网内其他机器上的大模型。

🌐 **项目主页：** <https://jhonsu01.github.io/SunsamCode/>

## 下载

安装包发布在 **[Releases](https://github.com/jhonsu01/SunsamCode/releases/latest)**。

| 系统    | 架构                                | 文件                                        |
| ------- | ----------------------------------- | ------------------------------------------- |
| Windows | x64                                 | `Sunsam.Code-<版本>-win-x64.exe`            |
| macOS   | Apple Silicon (arm64) / Intel (x64) | `.dmg` 或 `.zip`                            |
| Linux   | x64 / arm64                         | `.AppImage`、`.deb`、`.rpm`、`.pkg.tar.zst` |

> 安装包**未签名**。
> **macOS：** 拷贝到“应用程序”后执行 `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"`。
> **Windows：** SmartScreen → “更多信息” → “仍要运行”。
> **Linux（AppImage）：** `chmod +x Sunsam*.AppImage && ./Sunsam*.AppImage`。

每个 `v*` 标签都会通过 GitHub Actions 构建 Windows、macOS 和 Linux 并发布 Release
（[workflow](.github/workflows/sunsam-desktop-build.yml)）。

## 与 ZCode 的区别

|          | ZCode                                  | Sunsam Code                                                   |
| -------- | -------------------------------------- | ------------------------------------------------------------- |
| 品牌     | ZCode                                  | 应用、安装包、菜单和托盘均使用 Sunsam 名称与图标              |
| 模型设置 | 内置供应商（Z.ai、Start Plan）+ 自定义 | **仅自定义供应商**（LM Studio、Ollama、vLLM、Sunsam Mesh…）   |
| 模型路由 | 手动                                   | **Sunsam Mesh**：`sunsam-auto` 在本地模型与大模型之间自动选择 |
| 安装身份 | `dev.zcode.app`                        | `dev.sunsam.code`：可与 ZCode 并存                            |
| 上游更新 | —                                      | 每日自动同步 `zai-org/ZCode`，保留 Sunsam 定制层              |

## Sunsam Mesh：多机 P2P 路由

```text
Sunsam Code ──▶ Sunsam Mesh (127.0.0.1:4141)
                   │  路由器：Laya（校准概率）或启发式
                   ├── p_local ≥ 0.75 ─▶ local 层：蒸馏后的小模型（LM Studio / Ollama）
                   ├── p_local < 0.75 ─▶ swarm 层：大模型（vLLM、Petals、其他节点）
                   └── 后台：RLCD 对比样本 · 字节级蒸馏 · Laya 软标签
```

```bash
pnpm sunsam:mesh:init   # 生成 ~/.sunsam/mesh.json（编辑局域网内的 peers）
pnpm sunsam:mesh        # 在 http://127.0.0.1:4141 启动网关
```

在应用中：**模型设置 → 添加供应商 → Base URL `http://127.0.0.1:4141`**，然后选择
`sunsam-auto`、`sunsam-local` 或 `sunsam-swarm`。详见 [packages/sunsam-mesh](packages/sunsam-mesh/README.md)。

采用了论文 _Breaking the Token Ceiling_（arXiv 2609.12303）中的两项技术：

- **End-Of-Token 词元→字节转换**：用于字节级蒸馏，以及与分词器无关的路由训练标签。
- **每字节比特数（BPB）与字节/秒**：在分词器不同的模型之间做公平比较，决定由哪台机器处理请求。

## 从源码构建

需要 Node.js 24.14.0 与 pnpm 10.33.2（见 [mise.toml](mise.toml)）。

```bash
pnpm install
pnpm -r --filter "./packages/*" --filter "!@zcode/desktop" build
ZCODE_ENV=production \
ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/ \
ZCODE_NODE_DIST_MIRROR=https://nodejs.org/dist \
pnpm bundle:desktop -- --os linux --arch x64   # --os win | mac · --arch x64 | arm64
```

安装包输出到 `packages/desktop/dist/`。开发：`pnpm dev:desktop`（桌面）或 `pnpm dev:web`（Web）。

## 文档

- [定制层、构建与上游同步（西班牙语）](docs/sunsam/README.md)
- [改进与路线图：Laya、RLCD、P2P（西班牙语）](docs/sunsam/mejoras.md)
- [Sunsam Mesh](packages/sunsam-mesh/README.md) · [规格说明](packages/sunsam-mesh/SPEC.md)
- ZCode 原始文档（智能体功能、CLI、Web）：[上游 README](https://github.com/zai-org/ZCode#readme)

## 许可证

Apache-2.0。Sunsam Code 派生自 Z.ai 的 [ZCode](https://github.com/zai-org/ZCode)；参见
[LICENSE](LICENSE)、[NOTICE.md](NOTICE.md) 和 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

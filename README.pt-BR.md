# Sunsam Code

<p align="center"><img src="branding/sunsam/animated/sunsam-logo-animated-256.gif" alt="Sunsam Code" width="160" height="160" /></p>

<p align="center"><b>Um agente de programação de desktop com seus próprios modelos e um roteador P2P entre suas máquinas.</b></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <b>Português</b> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/jhonsu01/SunsamCode/releases/latest"><img src="https://img.shields.io/github/v/release/jhonsu01/SunsamCode?label=download&color=f4415e" alt="Release" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/"><img src="https://img.shields.io/badge/web-jhonsu01.github.io%2FSunsamCode-15121c" alt="Website" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/documentation.html"><img src="https://img.shields.io/badge/docs-9%20languages-fdb673" alt="Documentation" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" /></a>
</p>

O Sunsam Code é um fork de código aberto do [ZCode](https://github.com/zai-org/ZCode) (Z.ai) com marca própria, **provedores de modelos personalizados** (o provedor oficial da Z.ai continua opcional), **extensões MCP com um clique** e o **Sunsam Mesh**, um roteador que envia cada pedido a um modelo local pequeno ou a modelos grandes em outras máquinas da sua rede.

🌐 **Site:** <https://jhonsu01.github.io/SunsamCode/> · 📖 **Documentação:** <https://jhonsu01.github.io/SunsamCode/documentation.html>

## Downloads

Os instaladores são publicados em **[Releases](https://github.com/jhonsu01/SunsamCode/releases/latest)**.

| SO | Arquitetura | Arquivo |
| ------- | ----------------------------------- | ------------------------------------------- |
| Windows | x64 | `Sunsam-Code-<version>-win-x64.exe` |
| macOS | Apple Silicon (arm64) / Intel (x64) | `.dmg` / `.zip` |
| Linux | x64 / arm64 | `.AppImage`, `.deb`, `.rpm`, `.pkg.tar.zst` |

> O **instalador do Windows é assinado** (Authenticode SHA-256 com carimbo de tempo) com um certificado próprio, não de uma CA pública; macOS e Linux não são assinados.
> **Windows:** SmartScreen → _Mais informações_ → _Executar assim mesmo_.
> **macOS:** depois de copiar o app para Aplicativos execute `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"`.
> **Linux (AppImage):** `chmod +x Sunsam*.AppImage && ./Sunsam*.AppImage`.

O app **se atualiza sozinho** a partir destes Releases: no Windows e com a AppImage do Linux aparece o botão de atualizar (ao iniciar, a cada hora ou em _Ajuda → Verificar atualizações_); no macOS baixe o novo `.dmg`.

## Novidades da 3.17.1-sunsam.1

- **Baseado no ZCode 3.17.1**: sincronização de dados com dispositivos remotos (skills, MCP, plugins e configurações de modelos), novo assistente de conexão remota para SSH, WSL e Docker que continua conectando em segundo plano, gerenciamento de projetos, visualizadores integrados de Word, PDF, PowerPoint e Excel, editor de imagens, grupos de tarefas, instruções personalizadas e busca de ferramentas. O controle remoto pelo celular foi adaptado ao novo protocolo de pareamento e continua funcionando só na sua rede, sem conta Z.ai. Toda a interface está traduzida para os idiomas do Sunsam.
- **Os botões de copiar funcionam no celular**: no controle remoto, os ícones de copiar (tabelas, código, mensagens) falhavam com "clipboard-unavailable" porque a página é servida por HTTP na sua rede; agora copiam direto.
- **Controle remoto pelo celular sem servidores externos**: o app serve a página móvel e o relay de pareamento na sua rede local (o relay da Z.ai recusava as versões Sunsam com "Not found"). Escaneie o QR na mesma Wi-Fi; fora de casa, instale o Tailscale nos dois dispositivos.
- **As atualizações automáticas voltaram**: o botão de atualizar aparece de novo quando sai uma versão e _Ajuda → Verificar atualizações_ informa se você está na mais recente. A interface agora está totalmente traduzida para espanhol, português, francês, russo e coreano.
- **Baseado no ZCode 3.15.1**: UI Plugins (plugins com interface própria, como um fluxo com Excalidraw), controle remoto web pelo celular, fluxos de trabalho dinâmicos e muitas correções, integrados sem perder nenhum recurso do Sunsam.
- **Logo do Sunsam animado** ao iniciar e na introdução (feito com o conector EffectCraft e convertido em SVG + CSS); a marca d'água inicial e o diálogo Sobre mostram a marca Sunsam.
- **Documentação do produto** em 9 idiomas, em _Ajuda → Documentação_.
- **Relatar um problema** e **Solicitar um recurso** abrem formulários de issue no GitHub com a versão e o sistema preenchidos.

## O que muda em relação ao ZCode

| | ZCode | Sunsam Code |
| --- | --- | --- |
| Marca | ZCode | Logo animado e nome Sunsam no app, instaladores, menus e bandeja |
| Modelos | Provedores integrados (Z.ai, Start Plan) + Personalizado | **Provedores personalizados** (LM Studio, Ollama, vLLM, Sunsam Mesh…) + Z.ai opcional |
| Roteamento de modelos | Manual | **Sunsam Mesh**: `sunsam-auto` escolhe entre um modelo local e um grande |
| Identidade de instalação | `dev.zcode.app` | `dev.sunsam.code`: instala ao lado do ZCode |
| Extensões MCP | Servidores adicionados à mão | **Instale `.mcpb` / `.dxt`** com um botão, arrastando ou pelos marketplaces |
| Atualizações | Servidor da Z.ai | **GitHub Releases** deste repositório |
| Menu Ajuda | Documentação e formulários da Z.ai | **Documentação própria** e **issues do GitHub** |
| Idiomas | 中文, English | + Español, Português, Français, Русский, 한국어 |
| Esquemas de ferramentas | Enviados como estão | Adaptados ao que a API da Z.ai/GLM aceita (evita o erro `[1210]`) |

## Extensões MCP (`.mcpb` / `.dxt`) e marketplaces

O Sunsam Code instala extensões empacotadas no formato [MCP Bundle](https://github.com/modelcontextprotocol/mcpb), o mesmo das _Extensões_ do Claude Desktop.

1. Abra **Configurações → Servidores MCP**.
2. Clique em **Instalar extensão (.mcpb / .dxt)** ou **arraste** um ou mais arquivos para a tela.
3. Os caminhos de pastas e programas necessários são **detectados automaticamente**; **Procurar…** escolhe outro.
4. Clique em **Reiniciar agora** para o agente carregar a extensão.

Enviar o mesmo pacote de novo o **atualiza** mantendo suas configurações; sem Node.js no computador, é usado o que vem com o Sunsam Code. Em **Configurações → Servidores MCP → Marketplaces** o [marketplace do Sunsam](https://github.com/jhonsu01/marketplace-SunsamCode) instala conectores prontos (FilmCraft, PhotoCraft, WordCraft, PdfCraft, DesignCraft, Audacity…) com um clique e mostra **Atualizar** quando há versão nova.

## Sunsam Mesh: roteador P2P entre máquinas

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

No app: **Configurações de modelo → Adicionar provedor → URL base `http://127.0.0.1:4141`** e escolha `sunsam-auto`, `sunsam-local` ou `sunsam-swarm`. Detalhes: [packages/sunsam-mesh](packages/sunsam-mesh/README.md).

## Relatar problemas e propor ideias

Use **Ajuda → Relatar um problema** ou **Ajuda → Solicitar um recurso** no app, ou abra um [issue](https://github.com/jhonsu01/SunsamCode/issues/new/choose). Contribuições são bem-vindas: abra um pull request para `claude/nice-brown-v1jufb`.

## Branches

| Branch | Finalidade |
| --- | --- |
| `claude/nice-brown-v1jufb` | Desenvolvimento do Sunsam Code (releases e site saem daqui) |
| `main` | Sincronizada com a branch de desenvolvimento |
| `zcode-upstream` | Espelho do [zai-org/ZCode](https://github.com/zai-org/ZCode) para integrar novas versões |

## Compilar a partir do código

Requisitos: Node.js 24.14.0 e pnpm 10.33.2 ([mise.toml](mise.toml)).

```bash
pnpm install
pnpm -r --filter "./packages/*" --filter "!@zcode/desktop" build
ZCODE_ENV=production \
ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/ \
ZCODE_NODE_DIST_MIRROR=https://nodejs.org/dist \
pnpm bundle:desktop -- --os linux --arch x64   # --os win | mac · --arch x64 | arm64
```

Os instaladores ficam em `packages/desktop/dist/`. Desenvolvimento: `pnpm dev:desktop` (desktop) ou `pnpm dev:web` (web). Testes do Sunsam: `pnpm sunsam:test`.

## Documentação

- [Documentação do produto](https://jhonsu01.github.io/SunsamCode/documentation.html) (9 idiomas)
- [Camada de personalização, builds e sincronização com upstream (ES)](docs/sunsam/README.md)
- [Melhorias e roteiro: Laya, RLCD, P2P (ES)](docs/sunsam/mejoras.md)
- [Sunsam Mesh](packages/sunsam-mesh/README.md) · [Especificação](packages/sunsam-mesh/SPEC.md)
- Documentação original do ZCode: [README do upstream](https://github.com/zai-org/ZCode/blob/main/README.en.md)

## Licença

Apache-2.0. O Sunsam Code deriva do [ZCode](https://github.com/zai-org/ZCode) da Z.ai; veja [LICENSE](LICENSE), [NOTICE.md](NOTICE.md) e [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

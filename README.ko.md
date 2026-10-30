# Sunsam Code

<p align="center"><img src="branding/sunsam/animated/sunsam-logo-animated-256.gif" alt="Sunsam Code" width="160" height="160" /></p>

<p align="center"><b>내 모델로 동작하고 내 컴퓨터들 사이에서 P2P 라우팅을 하는 데스크톱 코딩 에이전트.</b></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <b>한국어</b>
</p>

<p align="center">
  <a href="https://github.com/jhonsu01/SunsamCode/releases/latest"><img src="https://img.shields.io/github/v/release/jhonsu01/SunsamCode?label=download&color=f4415e" alt="Release" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/"><img src="https://img.shields.io/badge/web-jhonsu01.github.io%2FSunsamCode-15121c" alt="Website" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/documentation.html"><img src="https://img.shields.io/badge/docs-9%20languages-fdb673" alt="Documentation" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" /></a>
</p>

Sunsam Code는 [ZCode](https://github.com/zai-org/ZCode)(Z.ai)의 오픈 소스 포크로, 자체 브랜드, **사용자 지정 모델 공급자**(Z.ai 공식 공급자는 선택 사항), **클릭 한 번으로 설치하는 MCP 확장**, 그리고 요청마다 로컬의 작은 모델 또는 네트워크의 다른 컴퓨터에 있는 큰 모델로 보내는 라우터 **Sunsam Mesh**를 갖추고 있습니다.

🌐 **웹사이트:** <https://jhonsu01.github.io/SunsamCode/> · 📖 **문서:** <https://jhonsu01.github.io/SunsamCode/documentation.html>

## 다운로드

설치 파일은 **[Releases](https://github.com/jhonsu01/SunsamCode/releases/latest)**에 게시됩니다.

| OS | 아키텍처 | 파일 |
| ------- | ----------------------------------- | ------------------------------------------- |
| Windows | x64 | `Sunsam-Code-<version>-win-x64.exe` |
| macOS | Apple Silicon (arm64) / Intel (x64) | `.dmg` / `.zip` |
| Linux | x64 / arm64 | `.AppImage`, `.deb`, `.rpm`, `.pkg.tar.zst` |

> **Windows 설치 파일은 서명되어 있습니다**(타임스탬프가 포함된 Authenticode SHA-256). 공개 CA가 아닌 작성자 자체 인증서이며, macOS와 Linux 빌드는 서명되지 않았습니다.
> **Windows:** SmartScreen → _추가 정보_ → _실행_.
> **macOS:** 응용 프로그램에 복사한 뒤 `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"`를 실행하세요.
> **Linux(AppImage):** `chmod +x Sunsam*.AppImage && ./Sunsam*.AppImage`.

앱은 이 Releases에서 **스스로 업데이트**됩니다. Windows와 Linux AppImage에서는 업데이트 버튼이 나타나고(시작 시, 매시간 또는 _도움말 → 업데이트 확인_), macOS에서는 새 `.dmg`를 내려받으세요.

## 3.17.1-sunsam.1의 새 기능

- **ZCode 3.17.1 기반**: 원격 기기로 데이터 동기화(스킬, MCP, 플러그인, 모델 설정), 백그라운드에서 계속 연결되는 SSH·WSL·Docker 원격 연결 마법사, 프로젝트 관리, Word·PDF·PowerPoint·Excel 내장 뷰어, 이미지 편집기, 작업 그룹, 사용자 지정 지침, 도구 검색. 휴대폰 원격 제어는 새 페어링 프로토콜에 맞게 조정되었으며 Z.ai 계정 없이 여전히 내 네트워크 안에서만 동작합니다. 전체 인터페이스가 Sunsam 언어로 번역되었습니다.
- **휴대폰에서 복사 버튼 작동**: 원격 제어에서 복사 아이콘(표, 코드, 메시지)이 페이지가 로컬 네트워크에서 HTTP로 제공되어 "clipboard-unavailable"로 실패했지만, 이제 바로 복사됩니다.
- **외부 서버 없는 휴대폰 원격 제어**: 앱이 로컬 네트워크에서 모바일 페이지와 페어링 릴레이를 직접 제공합니다(Z.ai 릴레이는 Sunsam 버전을 "Not found"로 거부했습니다). 같은 Wi-Fi에서 QR 코드를 스캔하고, 집 밖에서는 두 기기에 Tailscale을 설치하세요.
- **자동 업데이트 복구**: 새 버전이 나오면 업데이트 버튼이 다시 나타나고, _도움말 → 업데이트 확인_에서 최신 버전인지 알려 줍니다. UI가 스페인어, 포르투갈어, 프랑스어, 러시아어, 한국어로 완전히 번역되었습니다.
- **ZCode 3.15.1 기반**: UI Plugins(Excalidraw 워크플로처럼 자체 UI를 가진 플러그인), 휴대폰에서 쓰는 웹 원격 제어, 동적 워크플로와 많은 수정 사항을 Sunsam 기능을 잃지 않고 통합.
- 시작 화면과 소개 화면의 **Sunsam 애니메이션 로고**(EffectCraft 커넥터로 제작해 SVG + CSS로 구현). 홈 화면 워터마크와 정보 대화 상자도 Sunsam 브랜드로 변경.
- **제품 문서**를 9개 언어로 제공하며 _도움말 → 제품 문서_에서 열 수 있습니다.
- **문제 신고**와 **기능 요청**은 버전과 시스템이 미리 입력된 GitHub issue 양식을 엽니다.

## ZCode와 달라진 점

| | ZCode | Sunsam Code |
| --- | --- | --- |
| 브랜드 | ZCode | 앱, 설치 파일, 메뉴, 트레이에 Sunsam 애니메이션 로고와 이름 |
| 모델 | 내장 공급자(Z.ai, Start Plan) + 사용자 지정 | **사용자 지정 공급자**(LM Studio, Ollama, vLLM, Sunsam Mesh…) + 선택적 Z.ai |
| 모델 라우팅 | 수동 | **Sunsam Mesh**: `sunsam-auto`가 로컬 모델과 큰 모델 중에서 선택 |
| 설치 ID | `dev.zcode.app` | `dev.sunsam.code`: ZCode와 함께 설치 가능 |
| MCP 확장 | 서버를 직접 추가 | 버튼, 끌어다 놓기, 마켓플레이스로 **`.mcpb` / `.dxt` 설치** |
| 앱 업데이트 | Z.ai 서버 | 이 저장소의 **GitHub Releases** |
| 도움말 메뉴 | Z.ai 문서와 양식 | **자체 문서**와 **GitHub issues** |
| 언어 | 中文, English | + Español, Português, Français, Русский, 한국어 |
| 도구 스키마 | 그대로 전송 | Z.ai/GLM API가 받는 형식으로 변환(`[1210]` 오류 방지) |

## MCP 확장(`.mcpb` / `.dxt`)과 마켓플레이스

Sunsam Code는 Claude Desktop _확장_과 같은 [MCP Bundle](https://github.com/modelcontextprotocol/mcpb) 형식의 확장을 설치합니다.

1. **설정 → MCP 서버**를 엽니다.
2. **확장 설치 (.mcpb / .dxt)**를 누르거나 파일을 화면에 **끌어다 놓습니다**.
3. 확장에 필요한 폴더와 프로그램 경로는 **자동으로 감지**되며 **찾아보기…**로 바꿀 수 있습니다.
4. **지금 다시 시작**을 눌러 에이전트가 확장을 불러오게 합니다.

같은 패키지를 다시 올리면 설정을 유지한 채 **업데이트**됩니다. 컴퓨터에 Node.js가 없으면 Sunsam Code에 포함된 Node를 사용합니다. **설정 → MCP 서버 → 마켓플레이스**에서 [Sunsam 마켓플레이스](https://github.com/jhonsu01/marketplace-SunsamCode)가 준비된 커넥터(FilmCraft, PhotoCraft, WordCraft, PdfCraft, DesignCraft, Audacity…)를 클릭 한 번으로 설치하고, 새 버전이 나오면 **업데이트**를 표시합니다.

## Sunsam Mesh: 컴퓨터 간 P2P 라우터

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

앱에서 **모델 설정 → 공급자 추가 → 기본 URL `http://127.0.0.1:4141`**을 설정하고 `sunsam-auto`, `sunsam-local`, `sunsam-swarm` 중에서 고르세요. 자세한 내용: [packages/sunsam-mesh](packages/sunsam-mesh/README.md).

## 문제 신고와 아이디어 제안

앱에서 **도움말 → 문제 신고** 또는 **도움말 → 기능 요청**을 사용하거나 [issue](https://github.com/jhonsu01/SunsamCode/issues/new/choose)를 직접 여세요. 기여를 환영합니다. `claude/nice-brown-v1jufb`로 pull request를 보내 주세요.

## 브랜치

| 브랜치 | 용도 |
| --- | --- |
| `claude/nice-brown-v1jufb` | Sunsam Code 개발(릴리스와 웹사이트가 여기서 만들어짐) |
| `main` | 개발 브랜치와 동기화 |
| `zcode-upstream` | 새 버전을 병합하기 위한 [zai-org/ZCode](https://github.com/zai-org/ZCode) 미러 |

## 소스에서 빌드

요구 사항: Node.js 24.14.0과 pnpm 10.33.2([mise.toml](mise.toml)).

```bash
pnpm install
pnpm -r --filter "./packages/*" --filter "!@zcode/desktop" build
ZCODE_ENV=production \
ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/ \
ZCODE_NODE_DIST_MIRROR=https://nodejs.org/dist \
pnpm bundle:desktop -- --os linux --arch x64   # --os win | mac · --arch x64 | arm64
```

설치 파일은 `packages/desktop/dist/`에 만들어집니다. 개발: `pnpm dev:desktop`(데스크톱) 또는 `pnpm dev:web`(웹). Sunsam 테스트: `pnpm sunsam:test`.

## 문서

- [제품 문서](https://jhonsu01.github.io/SunsamCode/documentation.html)(9개 언어)
- [사용자 지정 계층, 빌드, upstream 동기화(스페인어)](docs/sunsam/README.md)
- [개선 사항과 로드맵: Laya, RLCD, P2P(스페인어)](docs/sunsam/mejoras.md)
- [Sunsam Mesh](packages/sunsam-mesh/README.md) · [사양](packages/sunsam-mesh/SPEC.md)
- ZCode 원본 문서: [upstream README](https://github.com/zai-org/ZCode/blob/main/README.en.md)

## 라이선스

Apache-2.0. Sunsam Code는 Z.ai의 [ZCode](https://github.com/zai-org/ZCode)에서 파생되었습니다. [LICENSE](LICENSE), [NOTICE.md](NOTICE.md), [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)를 참고하세요.

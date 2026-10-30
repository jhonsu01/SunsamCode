# Sunsam Code

<p align="center"><img src="branding/sunsam/animated/sunsam-logo-animated-256.gif" alt="Sunsam Code" width="160" height="160" /></p>

<p align="center"><b>Настольный агент для программирования на ваших собственных моделях с P2P-маршрутизатором между вашими машинами.</b></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <b>Русский</b> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/jhonsu01/SunsamCode/releases/latest"><img src="https://img.shields.io/github/v/release/jhonsu01/SunsamCode?label=download&color=f4415e" alt="Release" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/"><img src="https://img.shields.io/badge/web-jhonsu01.github.io%2FSunsamCode-15121c" alt="Website" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/documentation.html"><img src="https://img.shields.io/badge/docs-9%20languages-fdb673" alt="Documentation" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" /></a>
</p>

Sunsam Code — форк [ZCode](https://github.com/zai-org/ZCode) (Z.ai) с открытым исходным кодом, со своим брендом, **собственными провайдерами моделей** (официальный провайдер Z.ai остаётся опциональным), **MCP-расширениями в один клик** и **Sunsam Mesh** — маршрутизатором, который отправляет каждый запрос небольшой локальной модели или крупным моделям на других машинах вашей сети.

🌐 **Сайт:** <https://jhonsu01.github.io/SunsamCode/> · 📖 **Документация:** <https://jhonsu01.github.io/SunsamCode/documentation.html>

## Загрузки

Установщики публикуются в **[Releases](https://github.com/jhonsu01/SunsamCode/releases/latest)**.

| ОС | Архитектура | Файл |
| ------- | ----------------------------------- | ------------------------------------------- |
| Windows | x64 | `Sunsam-Code-<version>-win-x64.exe` |
| macOS | Apple Silicon (arm64) / Intel (x64) | `.dmg` / `.zip` |
| Linux | x64 / arm64 | `.AppImage`, `.deb`, `.rpm`, `.pkg.tar.zst` |

> **Установщик для Windows подписан** (Authenticode SHA-256 с меткой времени) собственным сертификатом автора, а не публичного УЦ; сборки для macOS и Linux не подписаны.
> **Windows:** SmartScreen → _Подробнее_ → _Выполнить в любом случае_.
> **macOS:** после копирования в «Программы» выполните `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"`.
> **Linux (AppImage):** `chmod +x Sunsam*.AppImage && ./Sunsam*.AppImage`.

Приложение **обновляется само** из этих Releases: в Windows и в Linux AppImage появляется кнопка обновления (при запуске, каждый час или через _Справка → Проверить обновления_); в macOS скачайте новый `.dmg`.

## Что нового в 3.17.1-sunsam.1

- **На основе ZCode 3.17.1**: синхронизация данных с удалёнными устройствами (навыки, MCP, плагины и настройки моделей), новый мастер удалённых подключений SSH, WSL и Docker с подключением в фоне, управление проектами, встроенные просмотрщики Word, PDF, PowerPoint и Excel, редактор изображений, группы задач, собственные инструкции и поиск инструментов. Удалённое управление с телефона переведено на новый протокол сопряжения и по-прежнему работает только в вашей сети, без учётной записи Z.ai. Весь интерфейс переведён на языки Sunsam.
- **Кнопки копирования работают на телефоне**: в удалённом управлении значки копирования (таблицы, код, сообщения) выдавали «clipboard-unavailable», потому что страница отдаётся по HTTP в локальной сети; теперь они копируют сразу.
- **Удалённое управление с телефона без внешних серверов**: приложение само раздаёт мобильную страницу и ретранслятор сопряжения в локальной сети (ретранслятор Z.ai отклонял версии Sunsam с ошибкой «Not found»). Сканируйте QR-код в той же сети Wi-Fi; вне дома установите Tailscale на оба устройства.
- **Автообновления снова работают**: кнопка обновления появляется, как только выходит новая версия, а _Справка → Проверить обновления_ показывает, установлена ли последняя. Интерфейс полностью переведён на испанский, португальский, французский, русский и корейский.
- **Основано на ZCode 3.15.1**: UI Plugins (плагины со своим интерфейсом, например процесс с Excalidraw), веб-управление с телефона, динамические рабочие процессы и множество исправлений — без потери функций Sunsam.
- **Анимированный логотип Sunsam** при запуске и во вводном экране (сделан с помощью коннектора EffectCraft и перенесён в SVG + CSS); водяной знак главного экрана и окно «О программе» показывают бренд Sunsam.
- **Документация продукта** на 9 языках — из меню _Справка_.
- **Сообщить о проблеме** и **Предложить функцию** открывают формы issue на GitHub с уже заполненными версией и системой.

## Отличия от ZCode

| | ZCode | Sunsam Code |
| --- | --- | --- |
| Бренд | ZCode | Анимированный логотип и название Sunsam в приложении, установщиках, меню и трее |
| Модели | Встроенные провайдеры (Z.ai, Start Plan) + свой | **Свои провайдеры** (LM Studio, Ollama, vLLM, Sunsam Mesh…) + Z.ai по желанию |
| Маршрутизация | Вручную | **Sunsam Mesh**: `sunsam-auto` выбирает между локальной и крупной моделью |
| Идентификатор установки | `dev.zcode.app` | `dev.sunsam.code`: ставится рядом с ZCode |
| MCP-расширения | Серверы добавляются вручную | **Установка `.mcpb` / `.dxt`** кнопкой, перетаскиванием или из маркетплейсов |
| Обновления | Сервер Z.ai | **GitHub Releases** этого репозитория |
| Меню «Справка» | Документация и формы Z.ai | **Своя документация** и **issues на GitHub** |
| Языки | 中文, English | + Español, Português, Français, Русский, 한국어 |
| Схемы инструментов | Отправляются как есть | Приводятся к формату, который принимает API Z.ai/GLM (без ошибки `[1210]`) |

## MCP-расширения (`.mcpb` / `.dxt`) и маркетплейсы

Sunsam Code устанавливает расширения в формате [MCP Bundle](https://github.com/modelcontextprotocol/mcpb) — том же, что и _Extensions_ в Claude Desktop.

1. Откройте **Настройки → MCP-серверы**.
2. Нажмите **Установить расширение (.mcpb / .dxt)** или **перетащите** файлы в окно.
3. Нужные пути к папкам и программам **определяются автоматически**; **Обзор…** позволяет выбрать другой.
4. Нажмите **Перезапустить**, чтобы агент загрузил расширение.

Повторная загрузка того же пакета его **обновляет** с сохранением настроек; без Node.js используется встроенный в Sunsam Code. В **Настройки → MCP-серверы → Маркетплейсы** [маркетплейс Sunsam](https://github.com/jhonsu01/marketplace-SunsamCode) ставит готовые коннекторы (FilmCraft, PhotoCraft, WordCraft, PdfCraft, DesignCraft, Audacity…) в один клик и показывает **Обновить** при выходе новой версии.

## Sunsam Mesh: P2P-маршрутизатор между машинами

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

В приложении: **Настройки моделей → Добавить провайдера → базовый URL `http://127.0.0.1:4141`**, затем выберите `sunsam-auto`, `sunsam-local` или `sunsam-swarm`. Подробнее: [packages/sunsam-mesh](packages/sunsam-mesh/README.md).

## Сообщения о проблемах и предложения

Используйте **Справка → Сообщить о проблеме** или **Справка → Предложить функцию** в приложении, либо откройте [issue](https://github.com/jhonsu01/SunsamCode/issues/new/choose). Вклад приветствуется: присылайте pull request в `claude/nice-brown-v1jufb`.

## Ветки

| Ветка | Назначение |
| --- | --- |
| `claude/nice-brown-v1jufb` | Разработка Sunsam Code (отсюда собираются релизы и сайт) |
| `main` | Синхронизирована с веткой разработки |
| `zcode-upstream` | Зеркало [zai-org/ZCode](https://github.com/zai-org/ZCode) для слияния новых версий |

## Сборка из исходников

Требования: Node.js 24.14.0 и pnpm 10.33.2 ([mise.toml](mise.toml)).

```bash
pnpm install
pnpm -r --filter "./packages/*" --filter "!@zcode/desktop" build
ZCODE_ENV=production \
ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/ \
ZCODE_NODE_DIST_MIRROR=https://nodejs.org/dist \
pnpm bundle:desktop -- --os linux --arch x64   # --os win | mac · --arch x64 | arm64
```

Установщики появляются в `packages/desktop/dist/`. Разработка: `pnpm dev:desktop` (десктоп) или `pnpm dev:web` (веб). Тесты Sunsam: `pnpm sunsam:test`.

## Документация

- [Документация продукта](https://jhonsu01.github.io/SunsamCode/documentation.html) (9 языков)
- [Слой кастомизации, сборки и синхронизация с upstream (ES)](docs/sunsam/README.md)
- [Улучшения и планы: Laya, RLCD, P2P (ES)](docs/sunsam/mejoras.md)
- [Sunsam Mesh](packages/sunsam-mesh/README.md) · [Спецификация](packages/sunsam-mesh/SPEC.md)
- Оригинальная документация ZCode: [README upstream](https://github.com/zai-org/ZCode/blob/main/README.en.md)

## Лицензия

Apache-2.0. Sunsam Code основан на [ZCode](https://github.com/zai-org/ZCode) от Z.ai; см. [LICENSE](LICENSE), [NOTICE.md](NOTICE.md) и [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

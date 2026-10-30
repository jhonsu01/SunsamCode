# Sunsam Code

<p align="center"><img src="branding/sunsam/animated/sunsam-logo-animated-256.gif" alt="Sunsam Code" width="160" height="160" /></p>

<p align="center"><b>Un agent de programmation de bureau avec vos propres modèles et un routeur P2P entre vos machines.</b></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <b>Français</b> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/jhonsu01/SunsamCode/releases/latest"><img src="https://img.shields.io/github/v/release/jhonsu01/SunsamCode?label=download&color=f4415e" alt="Release" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/"><img src="https://img.shields.io/badge/web-jhonsu01.github.io%2FSunsamCode-15121c" alt="Website" /></a>
  <a href="https://jhonsu01.github.io/SunsamCode/documentation.html"><img src="https://img.shields.io/badge/docs-9%20languages-fdb673" alt="Documentation" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" /></a>
</p>

Sunsam Code est un fork open source de [ZCode](https://github.com/zai-org/ZCode) (Z.ai) avec sa propre marque, des **fournisseurs de modèles personnalisés** (le fournisseur officiel Z.ai reste optionnel), des **extensions MCP en un clic** et **Sunsam Mesh**, un routeur qui envoie chaque requête à un petit modèle local ou à de grands modèles sur d'autres machines de votre réseau.

🌐 **Site:** <https://jhonsu01.github.io/SunsamCode/> · 📖 **Documentation:** <https://jhonsu01.github.io/SunsamCode/documentation.html>

## Téléchargements

Les installateurs sont publiés dans les **[Releases](https://github.com/jhonsu01/SunsamCode/releases/latest)**.

| OS | Architecture | Fichier |
| ------- | ----------------------------------- | ------------------------------------------- |
| Windows | x64 | `Sunsam-Code-<version>-win-x64.exe` |
| macOS | Apple Silicon (arm64) / Intel (x64) | `.dmg` / `.zip` |
| Linux | x64 / arm64 | `.AppImage`, `.deb`, `.rpm`, `.pkg.tar.zst` |

> L'**installateur Windows est signé** (Authenticode SHA-256 avec horodatage) avec un certificat de l'auteur, pas d'une autorité publique ; macOS et Linux ne sont pas signés.
> **Windows :** SmartScreen → _Informations complémentaires_ → _Exécuter quand même_.
> **macOS :** après la copie dans Applications, lancez `xattr -rd com.apple.quarantine "/Applications/Sunsam Code.app"`.
> **Linux (AppImage) :** `chmod +x Sunsam*.AppImage && ./Sunsam*.AppImage`.

L'app **se met à jour toute seule** depuis ces Releases : sous Windows et avec l'AppImage Linux, le bouton de mise à jour apparaît (au démarrage, toutes les heures ou via _Aide → Rechercher des mises à jour_) ; sous macOS, téléchargez le nouveau `.dmg`.

## Nouveautés de la 3.17.1-sunsam.1

- **Basé sur ZCode 3.17.1** : synchronisation des données vers les appareils distants (skills, MCP, plugins et réglages des modèles), nouvel assistant de connexion distante pour SSH, WSL et Docker qui continue en arrière-plan, gestion des projets, visionneuses intégrées pour Word, PDF, PowerPoint et Excel, éditeur d'images, groupes de tâches, instructions personnalisées et recherche d'outils. Le contrôle à distance depuis le téléphone a été adapté au nouveau protocole d'appairage et reste entièrement sur votre réseau, sans compte Z.ai. Toute l'interface est traduite dans les langues de Sunsam.
- **Les boutons de copie fonctionnent sur le téléphone** : dans le contrôle à distance, les icônes de copie (tableaux, code, messages) échouaient avec « clipboard-unavailable » car la page est servie en HTTP sur votre réseau ; elles copient désormais directement.
- **Contrôle à distance depuis le téléphone sans serveur externe** : l'app sert elle-même la page mobile et le relais d'appairage sur votre réseau local (le relais Z.ai refusait les versions Sunsam avec « Not found »). Scannez le QR sur le même Wi-Fi ; hors de chez vous, installez Tailscale sur les deux appareils.
- **Retour des mises à jour automatiques** : le bouton de mise à jour réapparaît quand une version sort, et _Aide → Rechercher des mises à jour_ indique si vous avez la plus récente. L'interface est désormais entièrement traduite en espagnol, portugais, français, russe et coréen.
- **Basé sur ZCode 3.15.1** : UI Plugins (plugins avec leur propre interface, comme un flux Excalidraw), contrôle à distance web depuis le téléphone, workflows dynamiques et de nombreux correctifs, intégrés sans perdre aucune fonction de Sunsam.
- **Logo Sunsam animé** au démarrage et dans l'introduction (créé avec le connecteur EffectCraft, rendu en SVG + CSS) ; le filigrane d'accueil et la boîte À propos affichent la marque Sunsam.
- **Documentation du produit** en 9 langues, depuis _Aide → Documentation du produit_.
- **Signaler un problème** et **Demander une fonctionnalité** ouvrent des formulaires d'issue GitHub avec la version et le système préremplis.

## Ce qui change par rapport à ZCode

| | ZCode | Sunsam Code |
| --- | --- | --- |
| Marque | ZCode | Logo animé et nom Sunsam dans l'app, les installateurs, les menus et la barre d'état |
| Modèles | Fournisseurs intégrés (Z.ai, Start Plan) + Personnalisé | **Fournisseurs personnalisés** (LM Studio, Ollama, vLLM, Sunsam Mesh…) + Z.ai optionnel |
| Routage des modèles | Manuel | **Sunsam Mesh** : `sunsam-auto` choisit entre un modèle local et un grand modèle |
| Identité d'installation | `dev.zcode.app` | `dev.sunsam.code` : s'installe à côté de ZCode |
| Extensions MCP | Serveurs ajoutés à la main | **Installez `.mcpb` / `.dxt`** d'un clic, par glisser-déposer ou depuis des marketplaces |
| Mises à jour | Serveur Z.ai | **GitHub Releases** de ce dépôt |
| Menu Aide | Documentation et formulaires Z.ai | **Documentation propre** et **issues GitHub** |
| Langues | 中文, English | + Español, Português, Français, Русский, 한국어 |
| Schémas d'outils | Envoyés tels quels | Adaptés à ce qu'accepte l'API Z.ai/GLM (évite l'erreur `[1210]`) |

## Extensions MCP (`.mcpb` / `.dxt`) et marketplaces

Sunsam Code installe des extensions au format [MCP Bundle](https://github.com/modelcontextprotocol/mcpb), le même que les _Extensions_ de Claude Desktop.

1. Ouvrez **Paramètres → Serveurs MCP**.
2. Cliquez sur **Installer une extension (.mcpb / .dxt)** ou **glissez** un ou plusieurs fichiers sur l'écran.
3. Les chemins de dossiers et de programmes nécessaires sont **détectés automatiquement** ; **Parcourir…** en choisit un autre.
4. Cliquez sur **Redémarrer maintenant** pour que l'agent charge l'extension.

Renvoyer le même paquet le **met à jour** en gardant vos réglages ; sans Node.js sur l'ordinateur, celui fourni avec Sunsam Code est utilisé. Dans **Paramètres → Serveurs MCP → Marketplaces**, le [marketplace Sunsam](https://github.com/jhonsu01/marketplace-SunsamCode) installe des connecteurs prêts à l'emploi (FilmCraft, PhotoCraft, WordCraft, PdfCraft, DesignCraft, Audacity…) en un clic et affiche **Mettre à jour** quand une version sort.

## Sunsam Mesh : routeur P2P entre machines

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

Dans l'app : **Paramètres des modèles → Ajouter un fournisseur → URL de base `http://127.0.0.1:4141`**, puis choisissez `sunsam-auto`, `sunsam-local` ou `sunsam-swarm`. Détails : [packages/sunsam-mesh](packages/sunsam-mesh/README.md).

## Signaler des problèmes et proposer des idées

Utilisez **Aide → Signaler un problème** ou **Aide → Demander une fonctionnalité** dans l'app, ou ouvrez une [issue](https://github.com/jhonsu01/SunsamCode/issues/new/choose). Les contributions sont bienvenues : ouvrez une pull request vers `claude/nice-brown-v1jufb`.

## Branches

| Branche | Rôle |
| --- | --- |
| `claude/nice-brown-v1jufb` | Développement de Sunsam Code (les releases et le site en sont issus) |
| `main` | Synchronisée avec la branche de développement |
| `zcode-upstream` | Miroir de [zai-org/ZCode](https://github.com/zai-org/ZCode) pour intégrer les nouvelles versions |

## Compiler depuis les sources

Prérequis : Node.js 24.14.0 et pnpm 10.33.2 ([mise.toml](mise.toml)).

```bash
pnpm install
pnpm -r --filter "./packages/*" --filter "!@zcode/desktop" build
ZCODE_ENV=production \
ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/ \
ZCODE_NODE_DIST_MIRROR=https://nodejs.org/dist \
pnpm bundle:desktop -- --os linux --arch x64   # --os win | mac · --arch x64 | arm64
```

Les installateurs sont écrits dans `packages/desktop/dist/`. Développement : `pnpm dev:desktop` (bureau) ou `pnpm dev:web` (web). Tests Sunsam : `pnpm sunsam:test`.

## Documentation

- [Documentation du produit](https://jhonsu01.github.io/SunsamCode/documentation.html) (9 langues)
- [Couche de personnalisation, builds et synchronisation upstream (ES)](docs/sunsam/README.md)
- [Améliorations et feuille de route : Laya, RLCD, P2P (ES)](docs/sunsam/mejoras.md)
- [Sunsam Mesh](packages/sunsam-mesh/README.md) · [Spécification](packages/sunsam-mesh/SPEC.md)
- Documentation originale de ZCode : [README upstream](https://github.com/zai-org/ZCode/blob/main/README.en.md)

## Licence

Apache-2.0. Sunsam Code est dérivé de [ZCode](https://github.com/zai-org/ZCode) de Z.ai ; voir [LICENSE](LICENSE), [NOTICE.md](NOTICE.md) et [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

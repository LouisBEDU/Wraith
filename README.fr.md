<p align="center">
  <img src="public/wraith.svg" width="96" alt="Logo Wraith" />
</p>

<h1 align="center">Wraith</h1>

<p align="center">
  Une application desktop pour gérer totalement Docker — en local et sur des serveurs distants via SSH — avec Tauri, React et Rust.
</p>

<p align="center">
  <a href="https://github.com/LouisBEDU/Wraith/blob/main/README.md"><img src="https://img.shields.io/badge/lang-en-red.svg" alt="English"></a>
  <a href="https://github.com/LouisBEDU/Wraith/blob/main/README.fr.md"><img src="https://img.shields.io/badge/lang-fr-blue.svg" alt="Français"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=white" alt="Tauri 2">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/Rust-edition%202024-CE412B?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/plateformes-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Plateformes">
</p>

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Démarrage](#démarrage)
- [Build d'une release](#build-dune-release)
- [Mises à jour automatiques](#mises-à-jour-automatiques)
- [Langues](#langues)
- [Sécurité](#sécurité)

## Fonctionnalités

- **Gestion complète de Docker** — conteneurs (liste, démarrage, arrêt, redémarrage, suppression et logs en direct), mais aussi images, volumes et réseaux (liste, suppression, nettoyage) depuis une interface native et soignée.
- **Hôtes distants en SSH** — gère Docker sur un autre serveur via une connexion SSH : enregistre des hôtes, change de cible active, et chaque vue suit la machine sélectionnée.
- **Pare-feu & ports** — visualise les règles entrantes et ouvre/ferme des ports (pare-feu Windows / ufw), avec des bascules IPv4/IPv6 par famille, plus la gestion du port SSH.
- **Espace disque en un coup d'œil** — la barre latérale affiche l'espace restant de la machine connectée (locale ou distante), rafraîchi automatiquement.
- **Rapide et mis en cache** — les données déjà chargées restent en mémoire pour un changement d'onglet instantané ; les vues affichent des loaders plutôt qu'un écran vide et se rafraîchissent automatiquement au changement de cible.
- **Mise à jour intégrée** — Wraith vérifie les releases GitHub au démarrage et permet d'installer les mises à jour en un clic depuis les Paramètres.
- **Multilingue** — Français et Anglais disponibles, changeables depuis les Paramètres.
- **Multiplateforme** — installeurs natifs pour Windows, macOS et Linux.

## Stack technique

| Couche   | Technologie                                   |
| -------- | --------------------------------------------- |
| Shell    | [Tauri 2](https://v2.tauri.app/)              |
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite 7 |
| Backend  | Rust                                          |
| i18n     | i18next / react-i18next                       |

## Démarrage

### Prérequis

- [Node.js](https://nodejs.org/) (LTS)
- [Rust](https://www.rust-lang.org/tools/install) (toolchain stable)
- [Docker](https://www.docker.com/) installé et lancé
- Les [prérequis spécifiques à ta plateforme](https://v2.tauri.app/start/prerequisites/) pour Tauri

### Installer les dépendances

```bash
npm install
```

### Lancer en développement

```bash
npm run tauri dev
```

Ça démarre le serveur de dev Vite et lance la fenêtre desktop Tauri. Le contrôle de Docker n'est disponible que depuis la fenêtre Tauri (il repose sur des commandes natives), pas depuis un simple navigateur.

## Build d'une release

```bash
npm run tauri build
```

Génère les installeurs natifs (`.exe` / `.msi` sur Windows, `.dmg` sur macOS, `.deb` / `.AppImage` sur Linux) dans `src-tauri/target/release/bundle`.

Les releases sont aussi construites automatiquement par GitHub Actions à chaque tag `v*` (voir [`.github/workflows/release.yml`](.github/workflows/release.yml)).

## Mises à jour automatiques

Wraith embarque un système de mise à jour (`tauri-plugin-updater`). Au lancement, il vérifie la dernière release GitHub publiée ; si une version plus récente existe, une bannière et un badge sur l'icône Paramètres permettent de télécharger, installer et redémarrer en un clic.

Pour les mainteneurs : les releases doivent être **publiées** (pas laissées en brouillon) pour que la mise à jour les détecte, et le pipeline de build nécessite les secrets `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` pour signer les artefacts de mise à jour.

## Langues

Wraith démarre par défaut en **Anglais**. Tu peux passer en **Français** à tout moment depuis les Paramètres — ton choix est mémorisé localement.

## Sécurité

Wraith a fait l'objet d'un audit de sécurité dédié :

- Content-Security-Policy stricte sur la webview desktop.
- Vérification de la clé hôte SSH (Trust On First Use) : l'empreinte de la clé d'un serveur est mémorisée au premier contact, et toute divergence ultérieure bloque la connexion pour se prémunir des attaques d'interception (man-in-the-middle).
- Les mots de passe SSH, passphrases de clé et mots de passe sudo sont stockés dans le trousseau du système (Keychain / Gestionnaire d'identifiants / Secret Service), jamais en clair.
- Les commandes shell distantes sont construites avec un échappement strict par guillemets simples pour empêcher l'injection d'arguments.

---

<p align="center">Réalisé par <a href="https://github.com/LouisBEDU">Dubsinho</a></p>

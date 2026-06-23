<p align="center">
  <img src="public/wraith.svg" width="96" alt="Wraith logo" />
</p>

<h1 align="center">Wraith</h1>

<p align="center">
  A desktop app to fully manage Docker — locally and on remote servers over SSH — built with Tauri, React and Rust.
</p>

<p align="center">
  <a href="https://github.com/LouisBEDU/Wraith/blob/main/README.md"><img src="https://img.shields.io/badge/lang-en-red.svg" alt="English"></a>
  <a href="https://github.com/LouisBEDU/Wraith/blob/main/README.fr.md"><img src="https://img.shields.io/badge/lang-fr-blue.svg" alt="Français"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=white" alt="Tauri 2">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/Rust-edition%202024-CE412B?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platforms">
</p>

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Building a release](#building-a-release)
- [Auto-updates](#auto-updates)
- [Languages](#languages)
- [Security](#security)

## Features

- **Full Docker management** — containers (list, start, stop, restart, remove and live logs), plus images, volumes and networks (list, remove, prune) from a clean, native UI.
- **Remote hosts over SSH** — manage Docker on another server through an SSH connection: save hosts, switch the active target, and every view follows the selected machine.
- **Firewall & ports** — view inbound rules and open/close ports (Windows Firewall / ufw), with per-family IPv4/IPv6 toggles, plus SSH port management.
- **Disk usage at a glance** — the sidebar shows the remaining storage of the machine you're connected to (local or remote), refreshed automatically.
- **Snappy & cached** — already-loaded data is kept in memory so switching tabs is instant; views show loaders instead of empty states and refresh automatically when you change target.
- **Built-in updater** — Wraith checks GitHub releases on startup and lets you install updates in one click from the Settings page.
- **Multilingual** — English and French out of the box, switchable from Settings.
- **Cross-platform** — native installers for Windows, macOS and Linux.

## Tech stack

| Layer    | Technology                                   |
| -------- | --------------------------------------------- |
| Shell    | [Tauri 2](https://v2.tauri.app/)              |
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite 7 |
| Backend  | Rust                                          |
| i18n     | i18next / react-i18next                       |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Docker](https://www.docker.com/) installed and running
- Tauri's [platform-specific prerequisites](https://v2.tauri.app/start/prerequisites/)

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run tauri dev
```

This starts the Vite dev server and launches the Tauri desktop window. Docker control is only available from the Tauri window (it relies on native commands), not from a plain browser.

## Building a release

```bash
npm run tauri build
```

Produces native installers (`.exe` / `.msi` on Windows, `.dmg` on macOS, `.deb` / `.AppImage` on Linux) in `src-tauri/target/release/bundle`.

Releases are also built automatically by GitHub Actions on every `v*` tag (see [`.github/workflows/release.yml`](.github/workflows/release.yml)).

## Auto-updates

Wraith ships with a built-in updater (`tauri-plugin-updater`). On startup, it checks the latest published GitHub release; if a newer version is available, a banner and a badge on the Settings icon let you download, install and restart in one click.

Maintainers: releases must be **published** (not left as drafts) for the updater to pick them up, and the build pipeline needs `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets configured to sign update artifacts.

## Languages

Wraith defaults to **English**. You can switch to **French** anytime from Settings — your choice is remembered locally.

## Security

Wraith has gone through a dedicated security pass:

- Strict Content-Security-Policy on the desktop webview.
- SSH host-key verification (Trust On First Use): a server's key fingerprint is remembered on first contact, and any later mismatch blocks the connection to guard against man-in-the-middle attacks.
- SSH passwords, key passphrases and sudo passwords are stored in the OS keychain (Keychain / Credential Manager / Secret Service), never in plain text.
- Remote shell commands are built with strict single-quote escaping to prevent argument injection.

---

<p align="center">Made by <a href="https://github.com/LouisBEDU">Dubsinho</a></p>

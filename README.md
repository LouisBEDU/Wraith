<p align="center">
  <img src="public/wraith.svg" width="96" alt="Wraith logo" />
</p>

<h1 align="center">Wraith</h1>

<p align="center">
  A desktop app to fully manage Docker — containers, web access, and more — built with Tauri, React and Rust.
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
- [Web access](#web-access)
- [Auto-updates](#auto-updates)
- [Languages](#languages)
- [Security](#security)

## Features

- **Container management** — list, start, stop, restart and remove your Docker containers from a clean, native UI.
- **Runs in the background** — closing the window doesn't quit Wraith: it keeps running from the system tray, and the embedded web server (if enabled) stays up.
- **Secure web access** — optionally expose a web UI on your local network to control Docker from any browser, protected by an Argon2-hashed password and short-lived signed sessions.
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

This starts the Vite dev server and launches the Tauri desktop window. You can also run `npm run dev` to preview the web UI alone in a browser, without Docker control.

## Building a release

```bash
npm run tauri build
```

Produces native installers (`.exe` / `.msi` on Windows, `.dmg` on macOS, `.deb` / `.AppImage` on Linux) in `src-tauri/target/release/bundle`.

Releases are also built automatically by GitHub Actions on every `v*` tag (see [`.github/workflows/release.yml`](.github/workflows/release.yml)).

## Web access

From **Settings**, you can enable web access to control Wraith from any device on your local network:

1. Toggle **Web access** on and pick a port.
2. Optionally set a password — strongly recommended if your network isn't fully trusted.
3. Open `http://<your-local-ip>:<port>` from any browser on the same network.

Passwords are hashed with Argon2 and never stored in plain text; sessions are short-lived signed cookies, not the page's password itself.

## Auto-updates

Wraith ships with a built-in updater (`tauri-plugin-updater`). On startup, it checks the latest published GitHub release; if a newer version is available, a banner and a badge on the Settings icon let you download, install and restart in one click.

Maintainers: releases must be **published** (not left as drafts) for the updater to pick them up, and the build pipeline needs `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets configured to sign update artifacts.

## Languages

Wraith defaults to **English**. You can switch to **French** anytime from Settings — your choice is remembered locally.

## Security

Wraith has gone through a dedicated security pass:

- Strict Content-Security-Policy on both the desktop webview and the embedded web server.
- Path-traversal protection on the embedded web server's static file handler.
- Argon2 password hashing, `HttpOnly` session cookies, and automatic session expiry.
- Security response headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) on every web response.

---

<p align="center">Made by <a href="https://github.com/LouisBEDU">Dubsinho</a></p>

// Source unique de vérité pour la version du projet : .env (VITE_APP_VERSION).
// Ce script la recopie dans package.json, src-tauri/Cargo.toml et
// src-tauri/tauri.conf.json, qui ont chacun leur propre champ "version"
// lu par leur outil respectif (npm, cargo, tauri) — aucun des trois ne
// sait lire un .env directement, donc on les synchronise ici.
//
// Lancé automatiquement avant `npm run dev` / `npm run build` (voir les
// scripts "predev"/"prebuild" dans package.json), donc avant `tauri dev`
// et `tauri build` aussi (qui passent par ces commandes).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function readEnvVersion() {
  const envPath = join(root, ".env");
  const env = readFileSync(envPath, "utf8");
  const match = env.match(/^VITE_APP_VERSION=(.+)$/m);
  if (!match) {
    throw new Error("VITE_APP_VERSION introuvable dans .env");
  }
  return match[1].trim();
}

function updatePackageJson(version) {
  const path = join(root, "package.json");
  const json = JSON.parse(readFileSync(path, "utf8"));
  if (json.version === version) return;
  json.version = version;
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
  console.log(`sync-version: package.json -> ${version}`);
}

function updateCargoToml(version) {
  const path = join(root, "src-tauri", "Cargo.toml");
  const content = readFileSync(path, "utf8");
  // Ne remplace que la PREMIÈRE ligne "version = ..." en début de ligne :
  // c'est celle du [package], pas les "version = .." des dépendances qui
  // sont écrites en table inline (`tauri = { version = "2", ... }`, donc
  // ne commencent jamais la ligne par "version").
  const updated = content.replace(/^version = ".*"$/m, `version = "${version}"`);
  if (updated !== content) {
    writeFileSync(path, updated);
    console.log(`sync-version: Cargo.toml -> ${version}`);
  }
}

function updateTauriConf(version) {
  const path = join(root, "src-tauri", "tauri.conf.json");
  const json = JSON.parse(readFileSync(path, "utf8"));
  if (json.version === version) return;
  json.version = version;
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
  console.log(`sync-version: tauri.conf.json -> ${version}`);
}

const version = readEnvVersion();
updatePackageJson(version);
updateCargoToml(version);
updateTauriConf(version);

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebServerSettings {
    pub enabled: bool,
    pub port: u16,
    #[serde(default)]
    pub password_hash: String,
    #[serde(default = "default_run_in_background")]
    pub run_in_background: bool,
}

fn default_run_in_background() -> bool {
    true
}

impl Default for WebServerSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            port: 1825,
            password_hash: String::new(),
            run_in_background: true,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct WebServerSettingsView {
    pub enabled: bool,
    pub port: u16,
    pub has_password: bool,
    pub run_in_background: bool,
}

impl From<&WebServerSettings> for WebServerSettingsView {
    fn from(settings: &WebServerSettings) -> Self {
        Self {
            enabled: settings.enabled,
            port: settings.port,
            has_password: !settings.password_hash.is_empty(),
            run_in_background: settings.run_in_background,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct WebServerSettingsInput {
    pub enabled: bool,
    pub port: u16,
    #[serde(default)]
    pub password: Option<String>,
    pub run_in_background: bool,
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

pub fn load(app: &AppHandle) -> WebServerSettings {
    settings_path(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn write(app: &AppHandle, settings: &WebServerSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

pub fn save(app: &AppHandle, input: &WebServerSettingsInput) -> Result<WebServerSettings, String> {
    let mut current = load(app);
    current.enabled = input.enabled;
    current.port = input.port;
    current.run_in_background = input.run_in_background;

    if let Some(password) = &input.password {
        current.password_hash = if password.is_empty() {
            String::new()
        } else {
            hash_password(password)?
        };
    }

    if current.port == 0 {
        return Err("Le port doit être compris entre 1 et 65535.".into());
    }

    // L'accès web donne le contrôle total de Docker (≈ root sur l'hôte) sur le
    // réseau : on refuse de l'activer sans mot de passe.
    if current.enabled && current.password_hash.is_empty() {
        return Err("Un mot de passe est requis pour activer l'accès web.".into());
    }

    write(app, &current)?;
    Ok(current)
}

fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| e.to_string())
}

pub fn verify_password(password_hash: &str, candidate: &str) -> bool {
    if password_hash.is_empty() {
        return false;
    }
    let Ok(parsed) = PasswordHash::new(password_hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(candidate.as_bytes(), &parsed)
        .is_ok()
}

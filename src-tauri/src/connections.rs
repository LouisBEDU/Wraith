use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const KEYRING_SERVICE: &str = "wraith-ssh";
const KEYRING_SUDO_SERVICE: &str = "wraith-ssh-sudo";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    #[serde(default)]
    pub key_path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConnectionInput {
    #[serde(default)]
    pub id: Option<String>,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    #[serde(default)]
    pub key_path: Option<String>,
    #[serde(default)]
    pub secret: Option<String>,
    #[serde(default)]
    pub sudo_password: Option<String>,
}

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("connections.json"))
}

pub fn list(app: &AppHandle) -> Vec<ConnectionProfile> {
    store_path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn write(app: &AppHandle, profiles: &[ConnectionProfile]) -> Result<(), String> {
    let path = store_path(app)?;
    let json = serde_json::to_string_pretty(profiles).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn keyring_entry(id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, id).map_err(|e| e.to_string())
}

fn sudo_entry(id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SUDO_SERVICE, id).map_err(|e| e.to_string())
}

pub fn secret(id: &str) -> Option<String> {
    keyring_entry(id).ok().and_then(|e| e.get_password().ok())
}

pub fn sudo_secret(id: &str) -> Option<String> {
    sudo_entry(id).ok().and_then(|e| e.get_password().ok())
}

fn store_secret(entry: Result<keyring::Entry, String>, value: &str) -> Result<(), String> {
    let entry = entry?;
    if value.is_empty() {
        let _ = entry.delete_credential();
        Ok(())
    } else {
        entry.set_password(value).map_err(|e| e.to_string())
    }
}

pub fn get(app: &AppHandle, id: &str) -> Option<ConnectionProfile> {
    list(app).into_iter().find(|p| p.id == id)
}

pub fn save(app: &AppHandle, input: ConnectionInput) -> Result<ConnectionProfile, String> {
    let id = input
        .id
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("{:016x}", rand::random::<u64>()));

    let profile = ConnectionProfile {
        id: id.clone(),
        name: input.name,
        host: input.host,
        port: input.port,
        username: input.username,
        auth_method: input.auth_method,
        key_path: input.key_path,
    };

    let mut profiles = list(app);
    match profiles.iter_mut().find(|p| p.id == id) {
        Some(existing) => *existing = profile.clone(),
        None => profiles.push(profile.clone()),
    }
    write(app, &profiles)?;

    if let Some(secret) = input.secret {
        store_secret(keyring_entry(&id), &secret)?;
    }
    if let Some(sudo) = input.sudo_password {
        store_secret(sudo_entry(&id), &sudo)?;
    }

    Ok(profile)
}

pub fn delete(app: &AppHandle, id: &str) -> Result<(), String> {
    let mut profiles = list(app);
    profiles.retain(|p| p.id != id);
    write(app, &profiles)?;
    if let Ok(entry) = keyring_entry(id) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = sudo_entry(id) {
        let _ = entry.delete_credential();
    }
    Ok(())
}

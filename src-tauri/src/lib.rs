mod docker;
mod settings;
mod web_server;

use settings::WebServerSettings;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use web_server::{RuntimeConfig, ServerHandle};

struct WebServerState {
    config: web_server::SharedConfig,
    handle: Mutex<Option<ServerHandle>>,
}

fn frontend_dir(app: &AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("dist")
    } else {
        app.path()
            .resource_dir()
            .expect("dossier de resources introuvable")
            .join("dist")
    }
}

fn apply_web_server_state(app: &AppHandle, settings: &WebServerSettings) -> Result<(), String> {
    let state = app.state::<WebServerState>();

    {
        let mut cfg = state.config.lock().unwrap();
        if cfg.password != settings.password {
            cfg.sessions.clear();
        }
        cfg.enabled = settings.enabled;
        cfg.password = settings.password.clone();
    }

    let mut guard = state.handle.lock().unwrap();
    let already_on_port = guard.as_ref().is_some_and(|h| h.port == settings.port);

    if settings.enabled && !already_on_port {
        if let Some(handle) = guard.take() {
            handle.stop();
        }
        let handle = web_server::start(settings.port, frontend_dir(app), state.config.clone())?;
        *guard = Some(handle);
    } else if !settings.enabled {
        if let Some(handle) = guard.take() {
            handle.stop();
        }
    }

    Ok(())
}

#[tauri::command]
fn docker_ps() -> Result<String, String> {
    docker::ps()
}

#[tauri::command]
fn docker_start(id: &str) -> Result<String, String> {
    docker::start(id)
}

#[tauri::command]
fn docker_stop(id: &str) -> Result<String, String> {
    docker::stop(id)
}

#[tauri::command]
fn docker_restart(id: &str) -> Result<String, String> {
    docker::restart(id)
}

#[tauri::command]
fn docker_remove(id: &str) -> Result<String, String> {
    docker::remove(id)
}

#[tauri::command]
fn get_web_server_settings(app: AppHandle) -> WebServerSettings {
    settings::load(&app)
}

#[tauri::command]
fn save_web_server_settings(app: AppHandle, settings: WebServerSettings) -> Result<(), String> {
    settings::save(&app, &settings)?;
    apply_web_server_state(&app, &settings)
}

#[tauri::command]
fn get_local_ip() -> Result<String, String> {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(WebServerState {
            config: Arc::new(Mutex::new(RuntimeConfig::default())),
            handle: Mutex::new(None),
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let settings = settings::load(&handle);
            if let Err(err) = apply_web_server_state(&handle, &settings) {
                eprintln!("web_server: impossible de démarrer le serveur web : {err}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            docker_ps,
            docker_start,
            docker_stop,
            docker_restart,
            docker_remove,
            get_web_server_settings,
            save_web_server_settings,
            get_local_ip
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

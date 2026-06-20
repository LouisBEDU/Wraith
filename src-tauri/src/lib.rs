mod docker;
mod settings;
mod web_server;

use settings::WebServerSettings;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WindowEvent};
use web_server::{RuntimeConfig, ServerHandle};

struct WebServerState {
    config: web_server::SharedConfig,
    handle: Mutex<Option<ServerHandle>>,
    run_in_background: AtomicBool,
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
        if cfg.password_hash != settings.password_hash {
            cfg.sessions.clear();
        }
        cfg.enabled = settings.enabled;
        cfg.password_hash = settings.password_hash.clone();
    }

    state
        .run_in_background
        .store(settings.run_in_background, Ordering::SeqCst);

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
fn get_web_server_settings(app: AppHandle) -> settings::WebServerSettingsView {
    settings::WebServerSettingsView::from(&settings::load(&app))
}

#[tauri::command]
fn save_web_server_settings(
    app: AppHandle,
    settings: settings::WebServerSettingsInput,
) -> Result<(), String> {
    let saved = settings::save(&app, &settings)?;
    apply_web_server_state(&app, &saved)
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(WebServerState {
            config: Arc::new(Mutex::new(RuntimeConfig::default())),
            handle: Mutex::new(None),
            run_in_background: AtomicBool::new(true),
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let settings = settings::load(&handle);
            if let Err(err) = apply_web_server_state(&handle, &settings) {
                eprintln!("web_server: impossible de démarrer le serveur web : {err}");
            }

            let show_item = MenuItem::with_id(app, "show", "Afficher Wraith", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let app_handle = handle.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        let state = app_handle.state::<WebServerState>();
                        if state.run_in_background.load(Ordering::SeqCst) {
                            api.prevent_close();
                            if let Some(w) = app_handle.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                    }
                });
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

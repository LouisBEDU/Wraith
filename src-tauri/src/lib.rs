mod connections;
mod docker;
mod firewall;
mod remote;
mod remote_admin;
mod settings;
mod ssh;
mod web_server;
#[cfg(target_os = "windows")]
mod winproc;

use serde::Serialize;
use settings::WebServerSettings;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State, WindowEvent};
use web_server::{RuntimeConfig, ServerHandle};

struct WebServerState {
    config: web_server::SharedConfig,
    handle: Mutex<Option<ServerHandle>>,
    run_in_background: AtomicBool,
}

#[derive(Default)]
struct ActiveTarget {
    conn: Mutex<Option<ActiveConn>>,
}

#[derive(Clone)]
struct ActiveConn {
    id: String,
    target: remote::Target,
}

fn resolve_remote(profile: &connections::ConnectionProfile) -> Result<remote::Target, String> {
    let secret = connections::secret(&profile.id);
    let auth = if profile.auth_method == "password" {
        remote::Auth::Password(
            secret.ok_or("Mot de passe introuvable pour cette connexion.".to_string())?,
        )
    } else {
        remote::Auth::Key {
            path: profile
                .key_path
                .clone()
                .ok_or("Chemin de clé privée manquant.".to_string())?,
            passphrase: secret.filter(|s| !s.is_empty()),
        }
    };
    Ok(remote::Target {
        host: profile.host.clone(),
        port: profile.port,
        username: profile.username.clone(),
        auth,
        sudo_password: connections::sudo_secret(&profile.id),
    })
}

fn shell_quote(arg: &str) -> String {
    format!("'{}'", arg.replace('\'', "'\\''"))
}

fn remote_command(program: &str, args: &[String]) -> String {
    let mut cmd = program.to_string();
    for arg in args {
        cmd.push(' ');
        cmd.push_str(&shell_quote(arg));
    }
    cmd
}

async fn docker_exec(target: &ActiveTarget, args: Vec<String>) -> Result<String, String> {
    let active = target.conn.lock().unwrap().clone();
    match active {
        None => tauri::async_runtime::spawn_blocking(move || docker::run_local(&args))
            .await
            .map_err(|e| e.to_string())?,
        Some(conn) => {
            let cmd = remote_command("docker", &args);
            let out = remote_admin::docker_run(&conn.target, &cmd).await?;
            if out.code == 0 {
                Ok(out.stdout)
            } else if !out.stderr.trim().is_empty() {
                Err(out.stderr.trim().to_string())
            } else {
                Err(format!("Commande distante en échec (code {}).", out.code))
            }
        }
    }
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

    let should_run = settings.enabled && !settings.password_hash.is_empty();

    let mut guard = state.handle.lock().unwrap();
    let already_on_port = guard.as_ref().is_some_and(|h| h.port == settings.port);

    if should_run && !already_on_port {
        if let Some(handle) = guard.take() {
            handle.stop();
        }
        let handle = web_server::start(settings.port, frontend_dir(app), state.config.clone())?;
        *guard = Some(handle);
    } else if !should_run {
        if let Some(handle) = guard.take() {
            handle.stop();
        }
    }

    Ok(())
}

#[tauri::command]
async fn docker_ps(target: State<'_, ActiveTarget>) -> Result<String, String> {
    docker_exec(&target, docker::ps_args()).await
}

#[tauri::command]
async fn docker_start(target: State<'_, ActiveTarget>, id: String) -> Result<String, String> {
    docker_exec(&target, docker::start_args(&id)).await
}

#[tauri::command]
async fn docker_stop(target: State<'_, ActiveTarget>, id: String) -> Result<String, String> {
    docker_exec(&target, docker::stop_args(&id)).await
}

#[tauri::command]
async fn docker_restart(target: State<'_, ActiveTarget>, id: String) -> Result<String, String> {
    docker_exec(&target, docker::restart_args(&id)).await
}

#[tauri::command]
async fn docker_remove(target: State<'_, ActiveTarget>, id: String) -> Result<String, String> {
    docker_exec(&target, docker::remove_args(&id)).await
}

#[tauri::command]
async fn docker_logs(target: State<'_, ActiveTarget>, id: String) -> Result<String, String> {
    let active = target.conn.lock().unwrap().clone();
    match active {
        None => tauri::async_runtime::spawn_blocking(move || docker::logs(&id))
            .await
            .map_err(|e| e.to_string())?,
        Some(conn) => {
            let cmd = remote_command("docker", &docker::logs_args(&id));
            let out = remote_admin::docker_run(&conn.target, &cmd).await?;
            Ok(docker::merge_logs(&out.stdout, &out.stderr))
        }
    }
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

#[derive(Serialize)]
struct SystemTools {
    docker: bool,
    firewall: firewall::FirewallStatus,
    ssh: ssh::SshStatus,
}

#[tauri::command]
async fn system_tools(target: State<'_, ActiveTarget>) -> Result<SystemTools, String> {
    let active = target.conn.lock().unwrap().clone();
    match active {
        None => tauri::async_runtime::spawn_blocking(|| SystemTools {
            docker: docker::available(),
            firewall: firewall::status(),
            ssh: ssh::status(),
        })
        .await
        .map_err(|e| e.to_string()),
        Some(conn) => Ok(SystemTools {
            docker: remote_admin::docker_available(&conn.target).await,
            firewall: remote_admin::firewall_status(&conn.target).await,
            ssh: remote_admin::ssh_status(&conn.target).await,
        }),
    }
}

#[tauri::command]
async fn connection_test(
    host: String,
    port: u16,
    username: String,
    auth_method: String,
    secret: Option<String>,
    key_path: Option<String>,
) -> Result<String, String> {
    let auth = if auth_method == "password" {
        remote::Auth::Password(secret.unwrap_or_default())
    } else {
        remote::Auth::Key {
            path: key_path.unwrap_or_default(),
            passphrase: secret.filter(|s| !s.is_empty()),
        }
    };

    let out = remote::run(&host, port, &username, &auth, "docker --version").await?;
    if out.code == 0 {
        Ok(out.stdout.trim().to_string())
    } else if !out.stderr.trim().is_empty() {
        Err(out.stderr.trim().to_string())
    } else {
        Err(format!("Commande distante en échec (code {}).", out.code))
    }
}

#[tauri::command]
fn connections_list(app: AppHandle) -> Vec<connections::ConnectionProfile> {
    connections::list(&app)
}

#[tauri::command]
fn connection_save(
    app: AppHandle,
    input: connections::ConnectionInput,
) -> Result<connections::ConnectionProfile, String> {
    connections::save(&app, input)
}

#[tauri::command]
fn connection_delete(
    app: AppHandle,
    target: State<'_, ActiveTarget>,
    id: String,
) -> Result<(), String> {
    {
        let mut guard = target.conn.lock().unwrap();
        if guard.as_ref().is_some_and(|c| c.id == id) {
            *guard = None;
        }
    }
    connections::delete(&app, &id)
}

#[tauri::command]
fn set_active_connection(
    app: AppHandle,
    target: State<'_, ActiveTarget>,
    id: Option<String>,
) -> Result<(), String> {
    match id {
        None => {
            *target.conn.lock().unwrap() = None;
            Ok(())
        }
        Some(id) => {
            let profile =
                connections::get(&app, &id).ok_or("Connexion introuvable.".to_string())?;
            let resolved = resolve_remote(&profile)?;
            *target.conn.lock().unwrap() = Some(ActiveConn {
                id,
                target: resolved,
            });
            Ok(())
        }
    }
}

#[tauri::command]
fn get_active_connection(target: State<'_, ActiveTarget>) -> Option<String> {
    target.conn.lock().unwrap().as_ref().map(|c| c.id.clone())
}

#[tauri::command]
async fn ssh_set_port(target: State<'_, ActiveTarget>, port: u16) -> Result<(), String> {
    let active = target.conn.lock().unwrap().clone();
    match active {
        None => tauri::async_runtime::spawn_blocking(move || ssh::set_port(port))
            .await
            .map_err(|e| e.to_string())?,
        Some(conn) => remote_admin::ssh_set_port(&conn.target, port).await,
    }
}

#[tauri::command]
async fn firewall_rules(target: State<'_, ActiveTarget>) -> Result<Vec<firewall::FirewallRule>, String> {
    let active = target.conn.lock().unwrap().clone();
    match active {
        None => tauri::async_runtime::spawn_blocking(firewall::rules)
            .await
            .map_err(|e| e.to_string())?,
        Some(conn) => remote_admin::firewall_rules(&conn.target).await,
    }
}

#[tauri::command]
async fn firewall_open_port(
    target: State<'_, ActiveTarget>,
    port: u16,
    protocol: String,
) -> Result<(), String> {
    let active = target.conn.lock().unwrap().clone();
    match active {
        None => tauri::async_runtime::spawn_blocking(move || firewall::open_port(port, &protocol))
            .await
            .map_err(|e| e.to_string())?,
        Some(conn) => remote_admin::firewall_open(&conn.target, port, &protocol).await,
    }
}

#[tauri::command]
async fn firewall_close_rule(
    target: State<'_, ActiveTarget>,
    id: String,
    port: String,
    protocol: String,
) -> Result<(), String> {
    let active = target.conn.lock().unwrap().clone();
    match active {
        None => {
            tauri::async_runtime::spawn_blocking(move || firewall::close_rule(&id, &port, &protocol))
                .await
                .map_err(|e| e.to_string())?
        }
        Some(conn) => remote_admin::firewall_close(&conn.target, &port, &protocol).await,
    }
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
        .manage(ActiveTarget::default())
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
            docker_logs,
            get_web_server_settings,
            save_web_server_settings,
            get_local_ip,
            system_tools,
            firewall_rules,
            firewall_open_port,
            firewall_close_rule,
            ssh_set_port,
            connection_test,
            connections_list,
            connection_save,
            connection_delete,
            set_active_connection,
            get_active_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod attach;
mod connections;
mod console;
mod disk;
mod docker;
mod events;
mod firewall;
mod known_hosts;
mod remote;
mod remote_admin;
mod ssh;
#[cfg(target_os = "windows")]
mod winproc;

use attach::AttachManager;
use console::ConsoleManager;
use events::EventsManager;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Default)]
struct ActiveTarget {
    conn: Mutex<Option<ActiveConn>>,
}

#[derive(Clone)]
struct ActiveConn {
    id: String,
    target: remote::Target,
}

fn known_hosts(app: &AppHandle) -> known_hosts::KnownHosts {
    let path = app
        .path()
        .app_config_dir()
        .map(|dir| dir.join("known_hosts.json"))
        .unwrap_or_else(|_| PathBuf::from("known_hosts.json"));
    known_hosts::KnownHosts::new(path)
}

fn resolve_remote(
    app: &AppHandle,
    profile: &connections::ConnectionProfile,
) -> Result<remote::Target, String> {
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
        known_hosts: known_hosts(app),
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

#[derive(Serialize)]
struct ExecOutput {
    stdout: String,
    stderr: String,
    code: i32,
}

#[tauri::command]
async fn docker_exec_command(
    target: State<'_, ActiveTarget>,
    id: String,
    shell: String,
    command: String,
) -> Result<ExecOutput, String> {
    let active = target.conn.lock().unwrap().clone();
    let args = docker::exec_args(&id, &shell, &command);
    match active {
        None => tauri::async_runtime::spawn_blocking(move || {
            docker::exec_capture(&args).map(|(stdout, stderr, code)| ExecOutput {
                stdout,
                stderr,
                code,
            })
        })
        .await
        .map_err(|e| e.to_string())?,
        Some(conn) => {
            let cmd = remote_command("docker", &args);
            let out = remote_admin::docker_run(&conn.target, &cmd).await?;
            Ok(ExecOutput {
                stdout: out.stdout,
                stderr: out.stderr,
                code: out.code,
            })
        }
    }
}

#[tauri::command]
async fn console_open(
    target: State<'_, ActiveTarget>,
    console: State<'_, ConsoleManager>,
    container_id: String,
    shell: String,
) -> Result<String, String> {
    let active = target.conn.lock().unwrap().clone();
    match active {
        None => console.open_local(&container_id, &shell).await,
        Some(conn) => console.open_remote(&conn.target, &container_id, &shell).await,
    }
}

#[tauri::command]
async fn console_exec(
    console: State<'_, ConsoleManager>,
    id: String,
    command: String,
) -> Result<console::ExecOutput, String> {
    match tokio::time::timeout(
        std::time::Duration::from_secs(60),
        console.exec(&id, &command),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => Err(
            "Délai dépassé : commande interactive ou incomplète non prise en charge.".to_string(),
        ),
    }
}

#[tauri::command]
async fn console_close(console: State<'_, ConsoleManager>, id: String) -> Result<(), String> {
    console.close(&id).await;
    Ok(())
}

#[tauri::command]
async fn attach_open(
    app: AppHandle,
    target: State<'_, ActiveTarget>,
    attach: State<'_, AttachManager>,
    container_id: String,
) -> Result<String, String> {
    let active = target.conn.lock().unwrap().clone();
    match active {
        None => attach.open_local(app, &container_id),
        Some(conn) => attach.open_remote(app, &conn.target, &container_id).await,
    }
}

#[tauri::command]
async fn attach_write(
    attach: State<'_, AttachManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    attach.write(&id, data.into_bytes()).await
}

#[tauri::command]
fn attach_close(attach: State<'_, AttachManager>, id: String) {
    attach.close(&id);
}

#[tauri::command]
async fn container_attachable(target: State<'_, ActiveTarget>, id: String) -> Result<bool, String> {
    let args = vec![
        "inspect".to_string(),
        "-f".to_string(),
        "{{.Config.OpenStdin}}".to_string(),
        id,
    ];
    let out = docker_exec(&target, args).await?;
    Ok(out.trim() == "true")
}

// ─── Images ───

#[tauri::command]
async fn docker_images(target: State<'_, ActiveTarget>) -> Result<String, String> {
    docker_exec(&target, docker::images_args()).await
}

#[tauri::command]
async fn docker_image_remove(target: State<'_, ActiveTarget>, id: String) -> Result<String, String> {
    docker_exec(&target, docker::image_remove_args(&id)).await
}

#[tauri::command]
async fn docker_image_prune(target: State<'_, ActiveTarget>) -> Result<String, String> {
    docker_exec(&target, docker::image_prune_args()).await
}

// ─── Volumes ───

#[tauri::command]
async fn docker_volumes(target: State<'_, ActiveTarget>) -> Result<String, String> {
    docker_exec(&target, docker::volumes_args()).await
}

#[tauri::command]
async fn docker_volume_remove(target: State<'_, ActiveTarget>, name: String) -> Result<String, String> {
    docker_exec(&target, docker::volume_remove_args(&name)).await
}

#[tauri::command]
async fn docker_volume_prune(target: State<'_, ActiveTarget>) -> Result<String, String> {
    docker_exec(&target, docker::volume_prune_args()).await
}

// ─── Réseaux ───

#[tauri::command]
async fn docker_networks(target: State<'_, ActiveTarget>) -> Result<String, String> {
    docker_exec(&target, docker::networks_args()).await
}

#[tauri::command]
async fn docker_network_remove(target: State<'_, ActiveTarget>, id: String) -> Result<String, String> {
    docker_exec(&target, docker::network_remove_args(&id)).await
}

#[tauri::command]
async fn docker_network_prune(target: State<'_, ActiveTarget>) -> Result<String, String> {
    docker_exec(&target, docker::network_prune_args()).await
}

#[tauri::command]
async fn disk_usage(target: State<'_, ActiveTarget>) -> Result<disk::DiskUsage, String> {
    let active = target.conn.lock().unwrap().clone();
    match active {
        None => tauri::async_runtime::spawn_blocking(disk::local)
            .await
            .map_err(|e| e.to_string())?,
        Some(conn) => remote_admin::disk_usage(&conn.target).await,
    }
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
    app: AppHandle,
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

    let store = known_hosts(&app);
    let out = remote::run(&host, port, &username, &auth, "docker --version", &store).await?;
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
async fn connection_delete(
    app: AppHandle,
    target: State<'_, ActiveTarget>,
    events: State<'_, EventsManager>,
    console: State<'_, ConsoleManager>,
    attach: State<'_, AttachManager>,
    id: String,
) -> Result<(), String> {
    let was_active = {
        let mut guard = target.conn.lock().unwrap();
        let active = guard.as_ref().is_some_and(|c| c.id == id);
        if active {
            *guard = None;
        }
        active
    };

    if was_active {
        console.close_all().await;
        attach.close_all();
        events.restart(app.clone(), None);
    }

    if let Some(profile) = connections::get(&app, &id) {
        known_hosts(&app).forget(&profile.host, profile.port);
    }
    connections::delete(&app, &id)
}

#[tauri::command]
async fn set_active_connection(
    app: AppHandle,
    target: State<'_, ActiveTarget>,
    events: State<'_, EventsManager>,
    console: State<'_, ConsoleManager>,
    attach: State<'_, AttachManager>,
    id: Option<String>,
) -> Result<(), String> {
    console.close_all().await;
    attach.close_all();
    match id {
        None => {
            *target.conn.lock().unwrap() = None;
            events.restart(app.clone(), None);
            Ok(())
        }
        Some(id) => {
            let profile =
                connections::get(&app, &id).ok_or("Connexion introuvable.".to_string())?;
            let resolved = resolve_remote(&app, &profile)?;
            *target.conn.lock().unwrap() = Some(ActiveConn {
                id,
                target: resolved.clone(),
            });

            events.restart(app.clone(), Some(resolved));
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
    ip_version: String,
) -> Result<(), String> {
    let active = target.conn.lock().unwrap().clone();
    match active {
        None => tauri::async_runtime::spawn_blocking(move || {
            firewall::open_port(port, &protocol, &ip_version)
        })
        .await
        .map_err(|e| e.to_string())?,
        Some(conn) => {
            remote_admin::firewall_open(&conn.target, port, &protocol, &ip_version).await
        }
    }
}

#[tauri::command]
async fn firewall_close_rule(
    target: State<'_, ActiveTarget>,
    id: String,
    port: String,
    protocol: String,
    ip_version: String,
) -> Result<(), String> {
    let active = target.conn.lock().unwrap().clone();
    match active {
        None => tauri::async_runtime::spawn_blocking(move || {
            firewall::close_rule(&id, &port, &protocol, &ip_version)
        })
        .await
        .map_err(|e| e.to_string())?,
        Some(conn) => {
            remote_admin::firewall_close(&conn.target, &id, &port, &protocol, &ip_version).await
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(ActiveTarget::default())
        .manage(EventsManager::default())
        .manage(ConsoleManager::default())
        .manage(AttachManager::default())
        .setup(|app| {
            let handle = app.handle().clone();
            app.state::<EventsManager>().restart(handle, None);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            docker_ps,
            docker_start,
            docker_stop,
            docker_restart,
            docker_remove,
            docker_logs,
            docker_exec_command,
            console_open,
            console_exec,
            console_close,
            attach_open,
            attach_write,
            attach_close,
            container_attachable,
            docker_images,
            docker_image_remove,
            docker_image_prune,
            docker_volumes,
            docker_volume_remove,
            docker_volume_prune,
            docker_networks,
            docker_network_remove,
            docker_network_prune,
            disk_usage,
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

use std::process::Command;

fn run_docker_command(args: &[&str]) -> Result<String, String> {
    println!("lib.run_docker_command() - Executing 'docker {}'...", args.join(" "));
    let output = Command::new("docker")
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        println!("lib.run_docker_command() - Error executing 'docker {}': {}", args.join(" "), stderr);
        return Err(stderr);
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}


#[tauri::command]
fn docker_ps() -> Result<String, String> {
    run_docker_command(&["ps", "--all", "--format", "json"])
}

#[tauri::command]
fn docker_start(id: &str) -> Result<String, String> {
    run_docker_command(&["start", id])
}

#[tauri::command]
fn docker_stop(id: &str) -> Result<String, String> {
    run_docker_command(&["stop", id])
}

#[tauri::command]
fn docker_restart(id: &str) -> Result<String, String> {
    run_docker_command(&["restart", id])
}

#[tauri::command]
fn docker_remove(id: &str) -> Result<String, String> {
    run_docker_command(&["rm", "--force", id])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            docker_ps,
            docker_start,
            docker_stop,
            docker_restart,
            docker_remove
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

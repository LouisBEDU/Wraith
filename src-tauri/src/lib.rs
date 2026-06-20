use std::process::Command;

#[tauri::command]
fn docker_ps() -> Result<String, String> {
    println!("Executing 'docker ps' command...");
    let output = Command::new("docker")
        .args(["ps", "--all", "--format", "json"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        println!("Error executing 'docker ps': {}", String::from_utf8_lossy(&output.stderr));
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    println!("Docker ps output: {}", String::from_utf8_lossy(&output.stdout));

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn run_docker_command(args: &[&str]) -> Result<String, String> {
    println!("Executing 'docker {}'...", args.join(" "));
    let output = Command::new("docker")
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        println!("Error executing 'docker {}': {}", args.join(" "), stderr);
        return Err(stderr);
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
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

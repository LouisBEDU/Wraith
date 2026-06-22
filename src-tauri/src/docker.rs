use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn build_command(args: &[&str]) -> Command {
    let mut command = Command::new("docker");
    command.args(args);

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    command
}

pub fn run_docker_command(args: &[&str]) -> Result<String, String> {
    if cfg!(debug_assertions) {
        println!("docker::run_docker_command() - Executing 'docker {}'...", args.join(" "));
    }

    let output = build_command(args).output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if cfg!(debug_assertions) {
            println!(
                "docker::run_docker_command() - Error executing 'docker {}': {}",
                args.join(" "),
                stderr
            );
        }
        return Err(stderr);
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn available() -> bool {
    build_command(&["--version"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn to_owned(args: &[&str]) -> Vec<String> {
    args.iter().map(|s| s.to_string()).collect()
}

pub fn ps_args() -> Vec<String> {
    to_owned(&["ps", "--all", "--format", "json"])
}
pub fn start_args(id: &str) -> Vec<String> {
    vec!["start".into(), id.into()]
}
pub fn stop_args(id: &str) -> Vec<String> {
    vec!["stop".into(), id.into()]
}
pub fn restart_args(id: &str) -> Vec<String> {
    vec!["restart".into(), id.into()]
}
pub fn remove_args(id: &str) -> Vec<String> {
    vec!["rm".into(), "--force".into(), id.into()]
}
pub fn logs_args(id: &str) -> Vec<String> {
    vec![
        "logs".into(),
        "--tail".into(),
        LOGS_TAIL_LINES.into(),
        "--timestamps".into(),
        id.into(),
    ]
}

// ─── Images / Volumes / Réseaux : arguments (chemin distant via docker_exec) ───

pub fn images_args() -> Vec<String> {
    to_owned(&["images", "--format", "json"])
}
pub fn image_remove_args(id: &str) -> Vec<String> {
    vec!["rmi".into(), "--force".into(), id.into()]
}
pub fn image_prune_args() -> Vec<String> {
    to_owned(&["image", "prune", "--force"])
}

pub fn volumes_args() -> Vec<String> {
    to_owned(&["volume", "ls", "--format", "json"])
}
pub fn volume_remove_args(name: &str) -> Vec<String> {
    vec!["volume".into(), "rm".into(), "--force".into(), name.into()]
}
pub fn volume_prune_args() -> Vec<String> {
    to_owned(&["volume", "prune", "--force"])
}

pub fn networks_args() -> Vec<String> {
    to_owned(&["network", "ls", "--format", "json"])
}
pub fn network_remove_args(id: &str) -> Vec<String> {
    vec!["network".into(), "rm".into(), id.into()]
}
pub fn network_prune_args() -> Vec<String> {
    to_owned(&["network", "prune", "--force"])
}

pub fn run_local(args: &[String]) -> Result<String, String> {
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_docker_command(&refs)
}

pub fn merge_logs(stdout: &str, stderr: &str) -> String {
    let mut lines: Vec<&str> = stdout.lines().chain(stderr.lines()).collect();
    lines.sort_by(|a, b| timestamp_key(a).cmp(timestamp_key(b)));
    lines.join("\n")
}

pub fn ps() -> Result<String, String> {
    run_docker_command(&["ps", "--all", "--format", "json"])
}

pub fn start(id: &str) -> Result<String, String> {
    run_docker_command(&["start", id])
}

pub fn stop(id: &str) -> Result<String, String> {
    run_docker_command(&["stop", id])
}

pub fn restart(id: &str) -> Result<String, String> {
    run_docker_command(&["restart", id])
}

pub fn remove(id: &str) -> Result<String, String> {
    run_docker_command(&["rm", "--force", id])
}

// ─── Images / Volumes / Réseaux : exécution locale (serveur web) ───

pub fn images() -> Result<String, String> {
    run_local(&images_args())
}
pub fn image_remove(id: &str) -> Result<String, String> {
    run_local(&image_remove_args(id))
}
pub fn image_prune() -> Result<String, String> {
    run_local(&image_prune_args())
}

pub fn volumes() -> Result<String, String> {
    run_local(&volumes_args())
}
pub fn volume_remove(name: &str) -> Result<String, String> {
    run_local(&volume_remove_args(name))
}
pub fn volume_prune() -> Result<String, String> {
    run_local(&volume_prune_args())
}

pub fn networks() -> Result<String, String> {
    run_local(&networks_args())
}
pub fn network_remove(id: &str) -> Result<String, String> {
    run_local(&network_remove_args(id))
}
pub fn network_prune() -> Result<String, String> {
    run_local(&network_prune_args())
}

const LOGS_TAIL_LINES: &str = "300";

pub fn logs(id: &str) -> Result<String, String> {
    let args = logs_args(id);
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let output = build_command(&refs).output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    Ok(merge_logs(&stdout, &stderr))
}

fn timestamp_key(line: &str) -> &str {
    line.split_once(' ').map(|(ts, _)| ts).unwrap_or(line)
}

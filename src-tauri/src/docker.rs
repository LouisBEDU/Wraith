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

const LOGS_TAIL_LINES: &str = "300";

pub fn logs(id: &str) -> Result<String, String> {
    let args = ["logs", "--tail", LOGS_TAIL_LINES, "--timestamps", id];

    if cfg!(debug_assertions) {
        println!("docker::logs() - Executing 'docker {}'...", args.join(" "));
    }

    let output = build_command(&args).output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // `docker logs --timestamps` préfixe chaque ligne d'un horodatage RFC3339.
    // On fusionne stdout + stderr en triant UNIQUEMENT sur cet horodatage, et de
    // façon stable : les lignes de même instant (entrées multi-lignes, traces
    // d'exception) conservent leur ordre d'origine au lieu d'être réordonnées
    // alphabétiquement par leur contenu.
    let mut lines: Vec<&str> = stdout.lines().chain(stderr.lines()).collect();
    lines.sort_by(|a, b| timestamp_key(a).cmp(timestamp_key(b)));

    Ok(lines.join("\n"))
}

/// Renvoie l'horodatage en tête de ligne (jusqu'au premier espace), ou la ligne
/// entière si aucun espace n'est présent.
fn timestamp_key(line: &str) -> &str {
    line.split_once(' ').map(|(ts, _)| ts).unwrap_or(line)
}

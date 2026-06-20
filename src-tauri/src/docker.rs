use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub fn run_docker_command(args: &[&str]) -> Result<String, String> {
    println!("docker::run_docker_command() - Executing 'docker {}'...", args.join(" "));

    let mut command = Command::new("docker");
    command.args(args);

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let output = command.output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        println!(
            "docker::run_docker_command() - Error executing 'docker {}': {}",
            args.join(" "),
            stderr
        );
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

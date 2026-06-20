use std::process::Command;

pub fn run_docker_command(args: &[&str]) -> Result<String, String> {
    println!("docker::run_docker_command() - Executing 'docker {}'...", args.join(" "));
    let output = Command::new("docker")
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

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

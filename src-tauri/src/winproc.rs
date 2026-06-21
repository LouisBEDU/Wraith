use std::io::Write;
use std::os::windows::process::CommandExt;
use std::process::{Command, Output};

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub fn run_powershell(script: &str) -> Result<Output, String> {
    let nonce: u64 = rand::random();
    let mut path = std::env::temp_dir();
    path.push(format!("wraith_{nonce}.ps1"));

    let script = format!(
        "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)\r\n{script}"
    );

    std::fs::File::create(&path)
        .and_then(|mut f| f.write_all(script.as_bytes()))
        .map_err(|e| e.to_string())?;

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(&path)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string());

    let _ = std::fs::remove_file(&path);
    output
}

pub fn run_elevated(inner: &str) -> Result<(), String> {
    let outer = format!(
        r#"
$inner = @'
{inner}
'@
$enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($inner))
try {{
  $p = Start-Process powershell -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand',$enc -Verb RunAs -WindowStyle Hidden -Wait -PassThru
  exit $p.ExitCode
}} catch {{ exit 2 }}
"#
    );

    let output = run_powershell(&outer)?;
    match output.status.code() {
        Some(0) => Ok(()),
        Some(2) => Err("Élévation refusée (UAC).".into()),
        _ => Err("Opération refusée (privilèges administrateur requis).".into()),
    }
}

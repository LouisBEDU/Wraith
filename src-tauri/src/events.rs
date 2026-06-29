use crate::remote::Target;
use serde::Serialize;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::watch;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const EVENT_NAME: &str = "docker:event";

const RETRY_DELAY: Duration = Duration::from_secs(3);

#[derive(Clone, Serialize)]
struct DockerEvent {
    #[serde(rename = "type")]
    kind: String,
    action: String,
}

#[derive(Default)]
pub struct EventsManager {
    cancel: Mutex<Option<watch::Sender<bool>>>,
}

impl EventsManager {
    fn stop(&self) {
        if let Some(tx) = self.cancel.lock().unwrap().take() {
            let _ = tx.send(true);
        }
    }

    pub fn restart(&self, app: AppHandle, target: Option<Target>) {
        self.stop();
        let (tx, rx) = watch::channel(false);
        *self.cancel.lock().unwrap() = Some(tx);

        tauri::async_runtime::spawn(async move {
            match target {
                None => watch_local(app, rx).await,
                Some(target) => watch_remote(app, target, rx).await,
            }
        });
    }
}

fn emit(app: &AppHandle, line: &str) {
    let line = line.trim();
    if line.is_empty() {
        return;
    }
    let Ok(value) = serde_json::from_str::<serde_json::Value>(line) else {
        return;
    };
    let kind = value.get("Type").and_then(|v| v.as_str()).unwrap_or("");
    if kind.is_empty() {
        return;
    }
    let action = value.get("Action").and_then(|v| v.as_str()).unwrap_or("");
    let _ = app.emit(
        EVENT_NAME,
        DockerEvent {
            kind: kind.to_string(),
            action: action.to_string(),
        },
    );
}

async fn wait_or_cancel(cancel: &mut watch::Receiver<bool>, dur: Duration) -> bool {
    tokio::select! {
        _ = cancel.changed() => true,
        _ = tokio::time::sleep(dur) => false,
    }
}

async fn watch_local(app: AppHandle, mut cancel: watch::Receiver<bool>) {
    loop {
        let mut command: tokio::process::Command = {
            let mut std = std::process::Command::new("docker");
            std.args(["events", "--format", "{{json .}}"])
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::null());
            #[cfg(target_os = "windows")]
            std.creation_flags(CREATE_NO_WINDOW);
            std.into()
        };
        command.kill_on_drop(true);

        let mut child = match command.spawn() {
            Ok(child) => child,
            Err(_) => {
                if wait_or_cancel(&mut cancel, RETRY_DELAY).await {
                    return;
                }
                continue;
            }
        };

        let Some(stdout) = child.stdout.take() else {
            return;
        };
        let mut lines = BufReader::new(stdout).lines();

        loop {
            tokio::select! {
                _ = cancel.changed() => {
                    let _ = child.start_kill();
                    return;
                }
                next = lines.next_line() => {
                    match next {
                        Ok(Some(line)) => emit(&app, &line),
                        Ok(None) | Err(_) => break,
                    }
                }
            }
        }

        if wait_or_cancel(&mut cancel, RETRY_DELAY).await {
            return;
        }
    }
}

async fn watch_remote(app: AppHandle, target: Target, mut cancel: watch::Receiver<bool>) {
    const COMMAND: &str = "docker events --format '{{json .}}'";
    loop {
        let _ = crate::remote::stream_target(&target, COMMAND, &mut cancel, |line| {
            emit(&app, line)
        })
        .await;

        if *cancel.borrow() {
            return;
        }
        if wait_or_cancel(&mut cancel, RETRY_DELAY).await {
            return;
        }
    }
}

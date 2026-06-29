use crate::remote::{RemoteShell, Target};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

const OUTPUT_EVENT: &str = "attach:output";
const CLOSED_EVENT: &str = "attach:closed";
const READ_BUF: usize = 8 * 1024;

#[derive(Clone, Serialize)]
struct AttachOutput {
    id: String,
    data: String,
    err: bool,
}

struct LocalSession {
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn Child + Send + Sync>>,
    _master: Mutex<Box<dyn MasterPty + Send>>,
}

enum Session {
    Local(LocalSession),
    Remote { tx: mpsc::Sender<Vec<u8>> },
}

#[derive(Default)]
pub struct AttachManager {
    sessions: Mutex<HashMap<String, Arc<Session>>>,
    counter: AtomicU64,
}

fn shell_quote(arg: &str) -> String {
    format!("'{}'", arg.replace('\'', "'\\''"))
}

impl AttachManager {
    fn next_id(&self) -> String {
        format!("attach-{}", self.counter.fetch_add(1, Ordering::Relaxed))
    }

    fn get(&self, id: &str) -> Option<Arc<Session>> {
        self.sessions.lock().unwrap().get(id).cloned()
    }

    pub fn open_local(&self, app: AppHandle, container: &str) -> Result<String, String> {
        let pty = native_pty_system();
        let pair = pty
            .openpty(PtySize {
                rows: 30,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        #[cfg(target_os = "windows")]
        let program = "docker.exe";
        #[cfg(not(target_os = "windows"))]
        let program = "docker";

        let mut cmd = CommandBuilder::new(program);
        cmd.arg("attach");
        cmd.arg("--sig-proxy=false");
        cmd.arg(container);
        for (key, value) in std::env::vars() {
            cmd.env(key, value);
        }

        let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
        let master = pair.master;

        let id = self.next_id();
        self.sessions.lock().unwrap().insert(
            id.clone(),
            Arc::new(Session::Local(LocalSession {
                writer: Mutex::new(writer),
                child: Mutex::new(child),
                _master: Mutex::new(master),
            })),
        );

        let session_id = id.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; READ_BUF];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => emit(&app, &session_id, &buf[..n], false),
                }
            }
            let _ = app.emit(CLOSED_EVENT, &session_id);
        });

        Ok(id)
    }

    pub async fn open_remote(
        &self,
        app: AppHandle,
        target: &Target,
        container: &str,
    ) -> Result<String, String> {
        let command = format!("docker attach --sig-proxy=false {}", shell_quote(container));
        let mut shell = RemoteShell::open_pty(target, &command).await?;

        let id = self.next_id();
        let (tx, mut rx) = mpsc::channel::<Vec<u8>>(64);
        self.sessions
            .lock()
            .unwrap()
            .insert(id.clone(), Arc::new(Session::Remote { tx }));

        let session_id = id.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                tokio::select! {
                    cmd = rx.recv() => match cmd {
                        Some(data) => {
                            if shell.write(&data).await.is_err() { break; }
                        }
                        None => break,
                    },
                    chunk = shell.next_chunk() => match chunk {
                        Some((err, data)) => emit(&app, &session_id, &data, err),
                        None => break,
                    },
                }
            }
            let _ = app.emit(CLOSED_EVENT, &session_id);
        });

        Ok(id)
    }

    pub async fn write(&self, id: &str, data: Vec<u8>) -> Result<(), String> {
        let session = self
            .get(id)
            .ok_or("Session d'attache introuvable.".to_string())?;
        match &*session {
            Session::Remote { tx } => tx
                .send(data)
                .await
                .map_err(|_| "Session d'attache fermée.".to_string()),
            Session::Local(_) => {
                let session = session.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    if let Session::Local(local) = &*session {
                        let mut writer = local.writer.lock().unwrap();
                        writer
                            .write_all(&data)
                            .and_then(|_| writer.flush())
                            .map_err(|e| e.to_string())
                    } else {
                        Ok(())
                    }
                })
                .await
                .map_err(|e| e.to_string())?
            }
        }
    }

    pub fn close(&self, id: &str) {
        if let Some(session) = self.sessions.lock().unwrap().remove(id) {
            if let Session::Local(local) = &*session {
                let _ = local.child.lock().unwrap().kill();
            }
        }
    }

    pub fn close_all(&self) {
        let sessions: Vec<_> = {
            let mut map = self.sessions.lock().unwrap();
            map.drain().map(|(_, v)| v).collect()
        };
        for session in sessions {
            if let Session::Local(local) = &*session {
                let _ = local.child.lock().unwrap().kill();
            }
        }
    }
}

fn emit(app: &AppHandle, id: &str, data: &[u8], err: bool) {
    let _ = app.emit(
        OUTPUT_EVENT,
        AttachOutput {
            id: id.to_string(),
            data: String::from_utf8_lossy(data).into_owned(),
            err,
        },
    );
}

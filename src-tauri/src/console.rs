use crate::remote::{RemoteShell, Target};
use serde::Serialize;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines};
use tokio::process::{Child, ChildStderr, ChildStdin, ChildStdout};
use tokio::sync::Mutex as AsyncMutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Serialize)]
pub struct ExecOutput {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
}

trait SessionIo {
    async fn write_all(&mut self, data: &[u8]) -> Result<(), String>;
    async fn next_line(&mut self) -> Option<(bool, String)>;
}

fn shell_quote(arg: &str) -> String {
    format!("'{}'", arg.replace('\'', "'\\''"))
}

fn take_line(buf: &mut Vec<u8>) -> Option<String> {
    let pos = buf.iter().position(|&b| b == b'\n')?;
    let line: Vec<u8> = buf.drain(..=pos).collect();
    let mut s = String::from_utf8_lossy(&line).into_owned();
    if s.ends_with('\n') {
        s.pop();
        if s.ends_with('\r') {
            s.pop();
        }
    }
    Some(s)
}

async fn drain_error<S: SessionIo>(io: &mut S) -> String {
    let mut message = String::new();
    while let Some((_, line)) = io.next_line().await {
        message.push_str(&line);
        message.push('\n');
    }
    let message = message.trim();
    if message.is_empty() {
        "Le shell s'est fermé (exec impossible : shell absent de l'image ?).".to_string()
    } else {
        message.to_string()
    }
}

async fn run_command<S: SessionIo>(
    io: &mut S,
    seq: u64,
    command: &str,
) -> Result<ExecOutput, String> {
    let out_mark = format!("__WRAITH_OUT_{seq}__");
    let err_mark = format!("__WRAITH_ERR_{seq}__");
    let payload =
        format!("{command}\nprintf '{out_mark}%s\\n' \"$?\"; printf '{err_mark}\\n' >&2\n");
    if io.write_all(payload.as_bytes()).await.is_err() {
        return Err(drain_error(io).await);
    }

    let mut out = String::new();
    let mut err = String::new();
    let mut code: i32 = -1;
    let mut out_done = false;
    let mut err_done = false;

    while !(out_done && err_done) {
        match io.next_line().await {
            None => {
                let tail = err.trim();
                return Err(if tail.is_empty() {
                    "La session shell s'est interrompue.".to_string()
                } else {
                    tail.to_string()
                });
            }
            Some((false, line)) => {
                if let Some(idx) = line.find(&out_mark) {
                    if idx > 0 {
                        out.push_str(&line[..idx]);
                        out.push('\n');
                    }
                    code = line[idx + out_mark.len()..].trim().parse().unwrap_or(-1);
                    out_done = true;
                } else if !out_done {
                    out.push_str(&line);
                    out.push('\n');
                }
            }
            Some((true, line)) => {
                if let Some(idx) = line.find(&err_mark) {
                    if idx > 0 {
                        err.push_str(&line[..idx]);
                        err.push('\n');
                    }
                    err_done = true;
                } else if !err_done {
                    err.push_str(&line);
                    err.push('\n');
                }
            }
        }
    }

    Ok(ExecOutput {
        stdout: out.trim_end_matches('\n').to_string(),
        stderr: err.trim_end_matches('\n').to_string(),
        code,
    })
}

struct LocalSession {
    child: Child,
    stdin: ChildStdin,
    stdout: Lines<BufReader<ChildStdout>>,
    stderr: Lines<BufReader<ChildStderr>>,
    stdout_done: bool,
    stderr_done: bool,
}

impl SessionIo for LocalSession {
    async fn write_all(&mut self, data: &[u8]) -> Result<(), String> {
        self.stdin.write_all(data).await.map_err(|e| e.to_string())?;
        self.stdin.flush().await.map_err(|e| e.to_string())
    }

    async fn next_line(&mut self) -> Option<(bool, String)> {
        loop {
            if self.stdout_done && self.stderr_done {
                return None;
            }
            tokio::select! {
                r = self.stdout.next_line(), if !self.stdout_done => match r {
                    Ok(Some(line)) => return Some((false, line)),
                    _ => self.stdout_done = true,
                },
                r = self.stderr.next_line(), if !self.stderr_done => match r {
                    Ok(Some(line)) => return Some((true, line)),
                    _ => self.stderr_done = true,
                },
            }
        }
    }
}

struct RemoteSession {
    shell: RemoteShell,
    out_buf: Vec<u8>,
    err_buf: Vec<u8>,
    closed: bool,
}

impl SessionIo for RemoteSession {
    async fn write_all(&mut self, data: &[u8]) -> Result<(), String> {
        self.shell.write(data).await
    }

    async fn next_line(&mut self) -> Option<(bool, String)> {
        loop {
            if let Some(line) = take_line(&mut self.out_buf) {
                return Some((false, line));
            }
            if let Some(line) = take_line(&mut self.err_buf) {
                return Some((true, line));
            }
            if self.closed {
                if !self.out_buf.is_empty() {
                    let line = String::from_utf8_lossy(&self.out_buf).into_owned();
                    self.out_buf.clear();
                    return Some((false, line));
                }
                if !self.err_buf.is_empty() {
                    let line = String::from_utf8_lossy(&self.err_buf).into_owned();
                    self.err_buf.clear();
                    return Some((true, line));
                }
                return None;
            }
            match self.shell.next_chunk().await {
                Some((false, data)) => self.out_buf.extend_from_slice(&data),
                Some((true, data)) => self.err_buf.extend_from_slice(&data),
                None => self.closed = true,
            }
        }
    }
}

enum Session {
    Local(LocalSession),
    Remote(RemoteSession),
}

impl SessionIo for Session {
    async fn write_all(&mut self, data: &[u8]) -> Result<(), String> {
        match self {
            Session::Local(s) => s.write_all(data).await,
            Session::Remote(s) => s.write_all(data).await,
        }
    }

    async fn next_line(&mut self) -> Option<(bool, String)> {
        match self {
            Session::Local(s) => s.next_line().await,
            Session::Remote(s) => s.next_line().await,
        }
    }
}

struct ConsoleSession {
    io: Session,
    seq: u64,
}

impl ConsoleSession {
    fn open_local(container: &str, shell: &str) -> Result<Self, String> {
        let mut std = std::process::Command::new("docker");
        std.args(["exec", "-i", container, shell])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(target_os = "windows")]
        std.creation_flags(CREATE_NO_WINDOW);

        let mut command: tokio::process::Command = std.into();
        command.kill_on_drop(true);
        let mut child = command.spawn().map_err(|e| e.to_string())?;

        let stdin = child.stdin.take().ok_or("stdin indisponible.".to_string())?;
        let stdout = child.stdout.take().ok_or("stdout indisponible.".to_string())?;
        let stderr = child.stderr.take().ok_or("stderr indisponible.".to_string())?;

        Ok(Self {
            io: Session::Local(LocalSession {
                child,
                stdin,
                stdout: BufReader::new(stdout).lines(),
                stderr: BufReader::new(stderr).lines(),
                stdout_done: false,
                stderr_done: false,
            }),
            seq: 0,
        })
    }

    async fn open_remote(target: &Target, container: &str, shell: &str) -> Result<Self, String> {
        let command = format!(
            "docker exec -i {} {}",
            shell_quote(container),
            shell_quote(shell)
        );
        let shell_io = RemoteShell::open(target, &command).await?;
        Ok(Self {
            io: Session::Remote(RemoteSession {
                shell: shell_io,
                out_buf: Vec::new(),
                err_buf: Vec::new(),
                closed: false,
            }),
            seq: 0,
        })
    }

    async fn exec(&mut self, command: &str) -> Result<ExecOutput, String> {
        self.seq += 1;
        run_command(&mut self.io, self.seq, command).await
    }

    async fn shutdown(&mut self) {
        if let Session::Local(s) = &mut self.io {
            let _ = s.stdin.shutdown().await;
            let _ = s.child.start_kill();
        }
    }
}

#[derive(Default)]
pub struct ConsoleManager {
    sessions: Mutex<HashMap<String, Arc<AsyncMutex<ConsoleSession>>>>,
    counter: AtomicU64,
}

impl ConsoleManager {
    fn insert(&self, session: ConsoleSession) -> String {
        let id = format!("console-{}", self.counter.fetch_add(1, Ordering::Relaxed));
        self.sessions
            .lock()
            .unwrap()
            .insert(id.clone(), Arc::new(AsyncMutex::new(session)));
        id
    }

    fn get(&self, id: &str) -> Option<Arc<AsyncMutex<ConsoleSession>>> {
        self.sessions.lock().unwrap().get(id).cloned()
    }

    pub async fn open_local(&self, container: &str, shell: &str) -> Result<String, String> {
        let session = ConsoleSession::open_local(container, shell)?;
        Ok(self.insert(session))
    }

    pub async fn open_remote(
        &self,
        target: &Target,
        container: &str,
        shell: &str,
    ) -> Result<String, String> {
        let session = ConsoleSession::open_remote(target, container, shell).await?;
        Ok(self.insert(session))
    }

    pub async fn exec(&self, id: &str, command: &str) -> Result<ExecOutput, String> {
        let session = self
            .get(id)
            .ok_or("Session de console introuvable.".to_string())?;
        let mut guard = session.lock().await;
        guard.exec(command).await
    }

    pub async fn close(&self, id: &str) {
        let removed = self.sessions.lock().unwrap().remove(id);
        if let Some(session) = removed {
            session.lock().await.shutdown().await;
        }
    }

    pub async fn close_all(&self) {
        let all: Vec<_> = {
            let mut map = self.sessions.lock().unwrap();
            map.drain().map(|(_, v)| v).collect()
        };
        for session in all {
            session.lock().await.shutdown().await;
        }
    }
}

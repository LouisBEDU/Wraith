use russh::client;
use russh::keys::{load_secret_key, PrivateKeyWithHashAlg};
use std::sync::Arc;

pub struct RemoteOutput {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
}

#[derive(Clone)]
pub enum Auth {
    Password(String),
    Key {
        path: String,
        passphrase: Option<String>,
    },
}

#[derive(Clone)]
pub struct Target {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: Auth,
    pub sudo_password: Option<String>,
}

pub async fn run_target(target: &Target, command: &str) -> Result<RemoteOutput, String> {
    exec(&target.host, target.port, &target.username, &target.auth, command, None).await
}

pub async fn run_target_stdin(
    target: &Target,
    command: &str,
    stdin: &[u8],
) -> Result<RemoteOutput, String> {
    exec(
        &target.host,
        target.port,
        &target.username,
        &target.auth,
        command,
        Some(stdin),
    )
    .await
}

struct Handler;

impl client::Handler for Handler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

pub async fn run(
    host: &str,
    port: u16,
    user: &str,
    auth: &Auth,
    command: &str,
) -> Result<RemoteOutput, String> {
    exec(host, port, user, auth, command, None).await
}

async fn exec(
    host: &str,
    port: u16,
    user: &str,
    auth: &Auth,
    command: &str,
    stdin: Option<&[u8]>,
) -> Result<RemoteOutput, String> {
    let config = Arc::new(client::Config::default());

    let mut session = client::connect(config, (host, port), Handler)
        .await
        .map_err(|e| format!("Connexion SSH impossible ({host}:{port}) : {e}"))?;

    let result = match auth {
        Auth::Password(password) => session
            .authenticate_password(user, password.clone())
            .await
            .map_err(|e| format!("Authentification échouée : {e}"))?,
        Auth::Key { path, passphrase } => {
            let key = load_secret_key(path, passphrase.as_deref())
                .map_err(|e| format!("Clé privée illisible ({path}) : {e}"))?;
            let hash = session
                .best_supported_rsa_hash()
                .await
                .map_err(|e| e.to_string())?
                .flatten();
            session
                .authenticate_publickey(user, PrivateKeyWithHashAlg::new(Arc::new(key), hash))
                .await
                .map_err(|e| format!("Authentification échouée : {e}"))?
        }
    };

    if !result.success() {
        return Err("Authentification refusée (identifiants invalides).".into());
    }

    let mut channel = session
        .channel_open_session()
        .await
        .map_err(|e| e.to_string())?;
    channel.exec(true, command).await.map_err(|e| e.to_string())?;

    if let Some(data) = stdin {
        channel.data(data).await.map_err(|e| e.to_string())?;
        let _ = channel.eof().await;
    }

    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let mut code = -1;

    while let Some(msg) = channel.wait().await {
        match msg {
            russh::ChannelMsg::Data { ref data } => stdout.extend_from_slice(data),
            russh::ChannelMsg::ExtendedData { ref data, .. } => stderr.extend_from_slice(data),
            russh::ChannelMsg::ExitStatus { exit_status } => code = exit_status as i32,
            _ => {}
        }
    }

    Ok(RemoteOutput {
        stdout: String::from_utf8_lossy(&stdout).to_string(),
        stderr: String::from_utf8_lossy(&stderr).to_string(),
        code,
    })
}

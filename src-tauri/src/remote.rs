use crate::known_hosts::{KnownHosts, Verdict};
use russh::client;
use russh::keys::ssh_key::HashAlg;
use russh::keys::{load_secret_key, PrivateKeyWithHashAlg};
use std::sync::{Arc, Mutex};

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
    pub known_hosts: KnownHosts,
}

pub async fn run_target(target: &Target, command: &str) -> Result<RemoteOutput, String> {
    exec(
        &target.host,
        target.port,
        &target.username,
        &target.auth,
        command,
        None,
        &target.known_hosts,
    )
    .await
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
        &target.known_hosts,
    )
    .await
}

struct Handler {
    host: String,
    port: u16,
    known_hosts: KnownHosts,
    /// Renseigné si la clé serveur est rejetée (empreinte changée), pour
    /// remonter un message explicite : `check_server_key` ne peut renvoyer
    /// qu'un booléen.
    rejection: Arc<Mutex<Option<String>>>,
}

impl client::Handler for Handler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &russh::keys::ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        let fingerprint = server_public_key.fingerprint(HashAlg::Sha256).to_string();
        match self.known_hosts.verify(&self.host, self.port, &fingerprint) {
            Verdict::Trusted => Ok(true),
            Verdict::Mismatch { stored, presented } => {
                *self.rejection.lock().unwrap() = Some(format!(
                    "⚠ La clé d'identité du serveur {}:{} a changé !\n\n\
                     Attendue : {stored}\n\
                     Reçue    : {presented}\n\n\
                     Connexion refusée par sécurité : cela peut signaler une tentative \
                     d'interception. Si ce changement est légitime (réinstallation du \
                     serveur, etc.), supprimez puis recréez cette connexion pour \
                     réaccorder la confiance.",
                    self.host, self.port
                ));
                Ok(false)
            }
        }
    }
}

pub async fn run(
    host: &str,
    port: u16,
    user: &str,
    auth: &Auth,
    command: &str,
    known_hosts: &KnownHosts,
) -> Result<RemoteOutput, String> {
    exec(host, port, user, auth, command, None, known_hosts).await
}

async fn exec(
    host: &str,
    port: u16,
    user: &str,
    auth: &Auth,
    command: &str,
    stdin: Option<&[u8]>,
    known_hosts: &KnownHosts,
) -> Result<RemoteOutput, String> {
    let config = Arc::new(client::Config::default());

    let rejection = Arc::new(Mutex::new(None));
    let handler = Handler {
        host: host.to_string(),
        port,
        known_hosts: known_hosts.clone(),
        rejection: rejection.clone(),
    };

    let mut session = match client::connect(config, (host, port), handler).await {
        Ok(session) => session,
        Err(err) => {
            // Une clé hôte rejetée fait échouer `connect` : on privilégie le
            // message explicite si la vérification a posé un veto.
            if let Some(message) = rejection.lock().unwrap().take() {
                return Err(message);
            }
            return Err(format!("Connexion SSH impossible ({host}:{port}) : {err}"));
        }
    };

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

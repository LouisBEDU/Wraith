//! Vérification de l'identité des serveurs SSH (Trust On First Use).
//!
//! On mémorise l'empreinte SHA-256 de la clé publique de chaque serveur au
//! premier contact, indexée par `host:port`. Aux connexions suivantes, on
//! refuse si l'empreinte présentée diffère de celle enregistrée : c'est le
//! filet contre une attaque d'interception (man-in-the-middle).

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Clone)]
pub struct KnownHosts {
    path: PathBuf,
}

/// Résultat de la vérification d'une empreinte serveur.
pub enum Verdict {
    /// Empreinte connue et identique, ou tout premier contact (mémorisée).
    Trusted,
    /// L'empreinte a changé : connexion à refuser.
    Mismatch { stored: String, presented: String },
}

impl KnownHosts {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    fn load(&self) -> HashMap<String, String> {
        fs::read_to_string(&self.path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }

    fn store(&self, map: &HashMap<String, String>) {
        if let Some(parent) = self.path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(map) {
            let _ = fs::write(&self.path, json);
        }
    }

    /// Vérifie (et mémorise au premier contact) l'empreinte d'un serveur.
    pub fn verify(&self, host: &str, port: u16, fingerprint: &str) -> Verdict {
        let key = format!("{host}:{port}");
        let mut map = self.load();
        match map.get(&key) {
            Some(stored) if stored == fingerprint => Verdict::Trusted,
            Some(stored) => Verdict::Mismatch {
                stored: stored.clone(),
                presented: fingerprint.to_string(),
            },
            None => {
                map.insert(key, fingerprint.to_string());
                self.store(&map);
                Verdict::Trusted
            }
        }
    }

    /// Oublie l'empreinte mémorisée pour un serveur (ex. suppression de la
    /// connexion). Permet de réétablir la confiance après un changement de clé
    /// légitime en supprimant puis recréant la connexion.
    pub fn forget(&self, host: &str, port: u16) {
        let key = format!("{host}:{port}");
        let mut map = self.load();
        if map.remove(&key).is_some() {
            self.store(&map);
        }
    }
}

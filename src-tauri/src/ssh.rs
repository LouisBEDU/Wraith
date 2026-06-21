//! Gestion du port du serveur SSH (OpenSSH).
//!
//! Change réellement le port d'écoute du serveur : édition de `sshd_config`,
//! mise à jour de la règle de pare-feu et redémarrage du service. Opérations
//! élevées (admin / root).
//!
//! - Windows : service `sshd`, config `%ProgramData%\ssh\sshd_config`.
//! - Linux   : service `ssh`/`sshd`, config `/etc/ssh/sshd_config`, via pkexec.
//! - macOS   : non pris en charge.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct SshStatus {
    /// Serveur OpenSSH installé.
    pub installed: bool,
    /// Service en cours d'exécution (None si indéterminable).
    pub running: Option<bool>,
    /// Port d'écoute actuel (None si inconnu).
    pub port: Option<u16>,
    /// La modification du port est possible sur cette plateforme.
    pub manageable: bool,
    /// Message d'information (non installé, plateforme non gérée…).
    pub message: Option<String>,
}

pub fn status() -> SshStatus {
    platform::status()
}

pub fn set_port(port: u16) -> Result<(), String> {
    if !(1..=65535).contains(&port) {
        return Err("Le port doit être compris entre 1 et 65535.".into());
    }
    platform::set_port(port)
}

// ───────────────────────────── Windows ─────────────────────────────

#[cfg(target_os = "windows")]
mod platform {
    use super::*;
    use crate::winproc::{run_elevated, run_powershell};
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct RawStatus {
        installed: bool,
        running: bool,
        port: i64,
    }

    pub fn status() -> SshStatus {
        let script = r#"
$svc = Get-Service sshd -ErrorAction SilentlyContinue
$installed = [bool]$svc
$running = if ($svc) { $svc.Status -eq 'Running' } else { $false }
$cfg = Join-Path $env:ProgramData 'ssh\sshd_config'
$port = 0
if (Test-Path $cfg) {
  $m = Select-String -Path $cfg -Pattern '^\s*Port\s+(\d+)' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($m) { $port = [int]$m.Matches[0].Groups[1].Value } else { $port = 22 }
}
[pscustomobject]@{ installed = $installed; running = $running; port = $port } | ConvertTo-Json -Compress
"#;

        let parsed = run_powershell(script).ok().and_then(|o| {
            if !o.status.success() {
                return None;
            }
            let stdout = String::from_utf8_lossy(&o.stdout);
            serde_json::from_str::<RawStatus>(stdout.trim_start_matches('\u{feff}').trim()).ok()
        });

        match parsed {
            Some(raw) => SshStatus {
                installed: raw.installed,
                running: Some(raw.running),
                port: u16::try_from(raw.port).ok().filter(|&p| p != 0),
                manageable: raw.installed,
                message: if raw.installed {
                    None
                } else {
                    Some("OpenSSH serveur n'est pas installé.".into())
                },
            },
            None => SshStatus {
                installed: false,
                running: None,
                port: None,
                manageable: false,
                message: Some("État SSH indéterminable.".into()),
            },
        }
    }

    pub fn set_port(port: u16) -> Result<(), String> {
        // Script élevé : réécrit la directive Port, recrée la règle de pare-feu
        // SSH gérée par Wraith pour le nouveau port, puis redémarre le service.
        let inner = format!(
            "try {{ \
             $cfg = Join-Path $env:ProgramData 'ssh\\sshd_config'; \
             if (-not (Test-Path $cfg)) {{ exit 3 }}; \
             $lines = @(Get-Content -LiteralPath $cfg | Where-Object {{ $_ -notmatch '^\\s*#?\\s*Port\\s+\\d+\\s*$' }}); \
             $lines += 'Port {port}'; \
             Set-Content -LiteralPath $cfg -Value $lines -Encoding ascii; \
             Get-NetFirewallRule -DisplayName 'Wraith - SSH *' -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue; \
             New-NetFirewallRule -DisplayName 'Wraith - SSH {port}/tcp' -Direction Inbound -Action Allow -Protocol TCP -LocalPort {port} -ErrorAction Stop | Out-Null; \
             Restart-Service sshd -ErrorAction Stop; \
             exit 0 }} catch {{ exit 1 }}"
        );
        run_elevated(&inner)
    }
}

// ────────────────────────────── Linux ──────────────────────────────

#[cfg(target_os = "linux")]
mod platform {
    use super::*;
    use std::path::Path;
    use std::process::Command;

    const CONFIG: &str = "/etc/ssh/sshd_config";

    fn current_port() -> Option<u16> {
        let content = std::fs::read_to_string(CONFIG).ok()?;
        for line in content.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("Port ") {
                if let Ok(p) = rest.trim().parse::<u16>() {
                    return Some(p);
                }
            }
        }
        Some(22)
    }

    fn service_running() -> Option<bool> {
        for unit in ["ssh", "sshd"] {
            if let Ok(out) = Command::new("systemctl").args(["is-active", unit]).output() {
                if String::from_utf8_lossy(&out.stdout).trim() == "active" {
                    return Some(true);
                }
            }
        }
        Some(false)
    }

    pub fn status() -> SshStatus {
        let installed = Path::new(CONFIG).exists();
        SshStatus {
            installed,
            running: if installed { service_running() } else { None },
            port: if installed { current_port() } else { None },
            manageable: installed,
            message: if installed {
                None
            } else {
                Some("OpenSSH serveur n'est pas installé.".into())
            },
        }
    }

    pub fn set_port(port: u16) -> Result<(), String> {
        if !Path::new(CONFIG).exists() {
            return Err("OpenSSH serveur n'est pas installé.".into());
        }
        // Édition de sshd_config + pare-feu ufw + redémarrage du service, le tout
        // élevé via pkexec.
        let script = format!(
            "set -e; \
             sed -i -E 's/^[[:space:]]*#?[[:space:]]*Port[[:space:]]+[0-9]+.*/Port {port}/' {cfg}; \
             grep -qE '^Port[[:space:]]+{port}$' {cfg} || echo 'Port {port}' >> {cfg}; \
             if command -v ufw >/dev/null 2>&1; then ufw allow {port}/tcp || true; fi; \
             systemctl restart ssh 2>/dev/null || systemctl restart sshd",
            cfg = CONFIG,
        );

        let output = Command::new("pkexec")
            .args(["sh", "-c", &script])
            .output()
            .map_err(|e| format!("pkexec indisponible : {e}"))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
}

// ────────────────────────────── macOS ──────────────────────────────

#[cfg(target_os = "macos")]
mod platform {
    use super::*;

    pub fn status() -> SshStatus {
        SshStatus {
            installed: false,
            running: None,
            port: None,
            manageable: false,
            message: Some("Gestion SSH non prise en charge sur macOS.".into()),
        }
    }

    pub fn set_port(_port: u16) -> Result<(), String> {
        Err("Gestion SSH non prise en charge sur macOS.".into())
    }
}

#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
mod platform {
    use super::*;

    pub fn status() -> SshStatus {
        SshStatus {
            installed: false,
            running: None,
            port: None,
            manageable: false,
            message: Some("Plateforme non prise en charge.".into()),
        }
    }

    pub fn set_port(_port: u16) -> Result<(), String> {
        Err("Plateforme non prise en charge.".into())
    }
}

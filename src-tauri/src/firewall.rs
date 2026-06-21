use serde::{Deserialize, Serialize};

#[cfg(target_os = "linux")]
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct FirewallStatus {
    pub backend: String,
    pub available: bool,
    pub manageable: bool,
    pub enabled: Option<bool>,
    pub needs_privileges: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FirewallRule {
    pub id: String,
    pub label: String,
    pub port: String,
    pub protocol: String,
    pub managed: bool,
}

#[allow(dead_code)]
fn normalize_protocol(protocol: &str) -> Result<&'static str, String> {
    match protocol.to_lowercase().as_str() {
        "tcp" => Ok("tcp"),
        "udp" => Ok("udp"),
        _ => Err("Protocole invalide (tcp ou udp).".into()),
    }
}

pub fn parse_ufw_rules(raw: &str) -> Vec<FirewallRule> {
    let mut rules = Vec::new();
    for line in raw.lines() {
        let line = line.trim();
        let Some(rest) = line.strip_prefix('[') else {
            continue;
        };
        let Some((num, body)) = rest.split_once(']') else {
            continue;
        };
        let id = num.trim().to_string();
        let body = body.trim();

        if !body.contains("ALLOW") {
            continue;
        }

        let target = body.split_whitespace().next().unwrap_or("");
        let (port, protocol) = match target.split_once('/') {
            Some((p, proto)) => (p.to_string(), proto.to_string()),
            None => continue,
        };

        if protocol != "tcp" && protocol != "udp" {
            continue;
        }

        rules.push(FirewallRule {
            id,
            label: format!("{port}/{protocol}"),
            port,
            protocol,
            managed: true,
        });
    }
    rules
}

// ───────────────────────────── Windows ─────────────────────────────

#[cfg(target_os = "windows")]
mod platform {
    use super::*;
    use crate::winproc::{run_elevated, run_powershell};

    #[derive(Deserialize)]
    struct RawRule {
        id: String,
        label: String,
        port: String,
        protocol: String,
        managed: bool,
    }

    pub fn status() -> FirewallStatus {
        let enabled = run_powershell(
            "if ((Get-NetFirewallProfile -ErrorAction SilentlyContinue | \
             Where-Object Enabled -eq $true | Measure-Object).Count -gt 0) \
             { 'true' } else { 'false' }",
        )
        .ok()
        .and_then(|o| match String::from_utf8_lossy(&o.stdout).trim() {
            "true" => Some(true),
            "false" => Some(false),
            _ => None,
        });

        FirewallStatus {
            backend: "windows".into(),
            available: true,
            manageable: true,
            enabled,
            needs_privileges: true,
            message: None,
        }
    }

    pub fn rules() -> Result<Vec<FirewallRule>, String> {
        let script = r#"
$rules = Get-NetFirewallRule -Direction Inbound -Action Allow -Enabled True -ErrorAction SilentlyContinue
$pf = Get-NetFirewallPortFilter -ErrorAction SilentlyContinue
$map = @{}
foreach ($p in $pf) { $map[$p.InstanceID] = $p }
$out = foreach ($r in $rules) {
  $f = $map[$r.InstanceID]
  if ($f -and $f.LocalPort -and $f.LocalPort -ne 'Any' -and ($f.Protocol -eq 'TCP' -or $f.Protocol -eq 'UDP')) {
    [pscustomobject]@{
      id = [string]$r.Name
      label = [string]$r.DisplayName
      port = [string]$f.LocalPort
      protocol = ([string]$f.Protocol).ToLower()
      managed = [bool]($r.DisplayName -like 'Wraith - *')
    }
  }
}
$json = $out | ConvertTo-Json -Compress
if ($null -eq $json) { '[]' } elseif ($json[0] -ne '[') { "[$json]" } else { $json }
"#;

        let output = run_powershell(script)?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let json = stdout.trim_start_matches('\u{feff}').trim();
        if json.is_empty() {
            return Ok(Vec::new());
        }

        serde_json::from_str::<Vec<RawRule>>(json)
            .map(|raws| {
                raws.into_iter()
                    .map(|r| FirewallRule {
                        id: r.id,
                        label: r.label,
                        port: r.port,
                        protocol: r.protocol,
                        managed: r.managed,
                    })
                    .collect()
            })
            .map_err(|e| format!("Lecture des règles du pare-feu impossible : {e}"))
    }

    pub fn open_port(port: u16, protocol: &str) -> Result<(), String> {
        let proto = normalize_protocol(protocol)?;
        let inner = format!(
            "try {{ New-NetFirewallRule -DisplayName 'Wraith - {port}/{proto}' \
             -Direction Inbound -Action Allow -Protocol {proto_up} -LocalPort {port} \
             -ErrorAction Stop | Out-Null; exit 0 }} catch {{ exit 1 }}",
            proto_up = proto.to_uppercase(),
        );
        run_elevated(&inner)
    }

    pub fn close_rule(id: &str, _port: &str, _protocol: &str) -> Result<(), String> {
        if id.is_empty() || id.contains('\'') {
            return Err("Identifiant de règle invalide.".into());
        }
        let inner = format!(
            "try {{ Remove-NetFirewallRule -Name '{id}' -ErrorAction Stop; exit 0 }} \
             catch {{ exit 1 }}"
        );
        run_elevated(&inner)
    }
}

// ────────────────────────────── Linux ──────────────────────────────

#[cfg(target_os = "linux")]
mod platform {
    use super::*;

    fn ufw_available() -> bool {
        Command::new("ufw")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    fn pkexec_available() -> bool {
        Command::new("pkexec")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    fn run_ufw(args: &[&str]) -> Result<String, String> {
        if !pkexec_available() {
            return Err("pkexec est requis pour gérer ufw avec des privilèges root.".into());
        }
        let output = Command::new("pkexec")
            .arg("ufw")
            .args(args)
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    pub fn status() -> FirewallStatus {
        let available = ufw_available();
        FirewallStatus {
            backend: "ufw".into(),
            available,
            manageable: available,
            enabled: None,
            needs_privileges: true,
            message: if available {
                None
            } else {
                Some("ufw n'est pas installé.".into())
            },
        }
    }

    pub fn rules() -> Result<Vec<FirewallRule>, String> {
        if !ufw_available() {
            return Err("ufw n'est pas installé.".into());
        }

        let raw = run_ufw(&["status", "numbered"])?;
        Ok(super::parse_ufw_rules(&raw))
    }

    pub fn open_port(port: u16, protocol: &str) -> Result<(), String> {
        let proto = normalize_protocol(protocol)?;
        run_ufw(&["allow", &format!("{port}/{proto}")]).map(|_| ())
    }

    pub fn close_rule(_id: &str, port: &str, protocol: &str) -> Result<(), String> {
        let proto = normalize_protocol(protocol)?;
        let port: u16 = port
            .parse()
            .map_err(|_| "Port invalide pour la suppression.".to_string())?;
        run_ufw(&["delete", "allow", &format!("{port}/{proto}")]).map(|_| ())
    }
}

// ────────────────────────────── macOS ──────────────────────────────

#[cfg(target_os = "macos")]
mod platform {
    use super::*;

    pub fn status() -> FirewallStatus {
        FirewallStatus {
            backend: "pf".into(),
            available: false,
            manageable: false,
            enabled: None,
            needs_privileges: true,
            message: Some(
                "La gestion du pare-feu macOS (pf) n'est pas encore prise en charge.".into(),
            ),
        }
    }

    pub fn rules() -> Result<Vec<FirewallRule>, String> {
        Ok(Vec::new())
    }

    pub fn open_port(_port: u16, _protocol: &str) -> Result<(), String> {
        Err("Gestion du pare-feu non prise en charge sur macOS.".into())
    }

    pub fn close_rule(_id: &str, _port: &str, _protocol: &str) -> Result<(), String> {
        Err("Gestion du pare-feu non prise en charge sur macOS.".into())
    }
}

// ─── Autres plateformes (filet de sécurité pour que ça compile partout) ───

#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
mod platform {
    use super::*;

    pub fn status() -> FirewallStatus {
        FirewallStatus {
            backend: "none".into(),
            available: false,
            manageable: false,
            enabled: None,
            needs_privileges: true,
            message: Some("Plateforme non prise en charge.".into()),
        }
    }

    pub fn rules() -> Result<Vec<FirewallRule>, String> {
        Ok(Vec::new())
    }

    pub fn open_port(_port: u16, _protocol: &str) -> Result<(), String> {
        Err("Plateforme non prise en charge.".into())
    }

    pub fn close_rule(_id: &str, _port: &str, _protocol: &str) -> Result<(), String> {
        Err("Plateforme non prise en charge.".into())
    }
}

pub fn status() -> FirewallStatus {
    platform::status()
}

pub fn rules() -> Result<Vec<FirewallRule>, String> {
    platform::rules()
}

pub fn open_port(port: u16, protocol: &str) -> Result<(), String> {
    platform::open_port(port, protocol)
}

pub fn close_rule(id: &str, port: &str, protocol: &str) -> Result<(), String> {
    platform::close_rule(id, port, protocol)
}

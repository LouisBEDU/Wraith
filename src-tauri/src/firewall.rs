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
    pub ip_versions: Vec<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FirewallRule {
    pub id: String,
    pub label: String,
    pub port: String,
    pub protocol: String,
    pub ip_version: String,
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

pub fn ufw_allow_args(port: u16, proto: &str, ip_version: &str) -> Result<Vec<String>, String> {
    let proto = normalize_protocol(proto)?;
    let p = port.to_string();
    let args = match ip_version {
        "any" => vec!["allow".into(), format!("{p}/{proto}")],
        "v4" => vec![
            "allow".into(),
            "proto".into(),
            proto.into(),
            "from".into(),
            "any".into(),
            "to".into(),
            "0.0.0.0/0".into(),
            "port".into(),
            p,
        ],
        "v6" => vec![
            "allow".into(),
            "proto".into(),
            proto.into(),
            "from".into(),
            "any".into(),
            "to".into(),
            "::/0".into(),
            "port".into(),
            p,
        ],
        _ => return Err("Famille d'adresses invalide (v4, v6 ou any).".into()),
    };
    Ok(args)
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

        let ip_version = if body.contains("(v6)") { "v6" } else { "v4" };

        rules.push(FirewallRule {
            id,
            label: format!("{port}/{protocol}"),
            port,
            protocol,
            ip_version: ip_version.to_string(),
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
            ip_versions: vec!["any".into()],
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
                        ip_version: "any".into(),
                        managed: r.managed,
                    })
                    .collect()
            })
            .map_err(|e| format!("Lecture des règles du pare-feu impossible : {e}"))
    }

    pub fn open_port(port: u16, protocol: &str, _ip_version: &str) -> Result<(), String> {
        let proto = normalize_protocol(protocol)?;
        let inner = format!(
            "try {{ New-NetFirewallRule -DisplayName 'Wraith - {port}/{proto}' \
             -Direction Inbound -Action Allow -Protocol {proto_up} -LocalPort {port} \
             -ErrorAction Stop | Out-Null; exit 0 }} catch {{ exit 1 }}",
            proto_up = proto.to_uppercase(),
        );
        run_elevated(&inner)
    }

    pub fn close_rule(id: &str, _port: &str, _protocol: &str, _ip_version: &str) -> Result<(), String> {
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
            ip_versions: if available {
                vec!["v4".into(), "v6".into()]
            } else {
                Vec::new()
            },
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

    pub fn open_port(port: u16, protocol: &str, ip_version: &str) -> Result<(), String> {
        let proto = normalize_protocol(protocol)?;
        let args = super::ufw_allow_args(port, proto, ip_version)?;
        let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        run_ufw(&refs).map(|_| ())
    }

    pub fn close_rule(id: &str, _port: &str, _protocol: &str, _ip_version: &str) -> Result<(), String> {
        let num: u32 = id
            .parse()
            .map_err(|_| "Numéro de règle invalide pour la suppression.".to_string())?;
        run_ufw(&["--force", "delete", &num.to_string()]).map(|_| ())
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
            ip_versions: Vec::new(),
            message: Some(
                "La gestion du pare-feu macOS (pf) n'est pas encore prise en charge.".into(),
            ),
        }
    }

    pub fn rules() -> Result<Vec<FirewallRule>, String> {
        Ok(Vec::new())
    }

    pub fn open_port(_port: u16, _protocol: &str, _ip_version: &str) -> Result<(), String> {
        Err("Gestion du pare-feu non prise en charge sur macOS.".into())
    }

    pub fn close_rule(_id: &str, _port: &str, _protocol: &str, _ip_version: &str) -> Result<(), String> {
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
            ip_versions: Vec::new(),
            message: Some("Plateforme non prise en charge.".into()),
        }
    }

    pub fn rules() -> Result<Vec<FirewallRule>, String> {
        Ok(Vec::new())
    }

    pub fn open_port(_port: u16, _protocol: &str, _ip_version: &str) -> Result<(), String> {
        Err("Plateforme non prise en charge.".into())
    }

    pub fn close_rule(_id: &str, _port: &str, _protocol: &str, _ip_version: &str) -> Result<(), String> {
        Err("Plateforme non prise en charge.".into())
    }
}

pub fn status() -> FirewallStatus {
    platform::status()
}

pub fn rules() -> Result<Vec<FirewallRule>, String> {
    platform::rules()
}

pub fn open_port(port: u16, protocol: &str, ip_version: &str) -> Result<(), String> {
    platform::open_port(port, protocol, ip_version)
}

pub fn close_rule(id: &str, port: &str, protocol: &str, ip_version: &str) -> Result<(), String> {
    platform::close_rule(id, port, protocol, ip_version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ufw_v4_and_v6_lines() {
        let raw = "\
Status: active

     To                         Action      From
     --                         ------      ----
[ 1] 22/tcp                     ALLOW IN    Anywhere
[ 2] 8080/tcp                   ALLOW IN    Anywhere
[ 3] 22/tcp (v6)                ALLOW IN    Anywhere (v6)
[ 4] 8080/tcp (v6)              ALLOW IN    Anywhere (v6)
";
        let rules = parse_ufw_rules(raw);
        assert_eq!(rules.len(), 4);

        let v4 = rules.iter().find(|r| r.id == "1").unwrap();
        assert_eq!((v4.port.as_str(), v4.protocol.as_str(), v4.ip_version.as_str()), ("22", "tcp", "v4"));

        let v6 = rules.iter().find(|r| r.id == "3").unwrap();
        assert_eq!((v6.port.as_str(), v6.protocol.as_str(), v6.ip_version.as_str()), ("22", "tcp", "v6"));

        let port_22: Vec<_> = rules.iter().filter(|r| r.port == "22").collect();
        assert_eq!(port_22.len(), 2);
    }

    #[test]
    fn ufw_allow_args_per_family() {
        assert_eq!(ufw_allow_args(8080, "tcp", "any").unwrap(), vec!["allow", "8080/tcp"]);
        assert_eq!(
            ufw_allow_args(8080, "tcp", "v4").unwrap(),
            vec!["allow", "proto", "tcp", "from", "any", "to", "0.0.0.0/0", "port", "8080"]
        );
        assert_eq!(
            ufw_allow_args(8080, "tcp", "v6").unwrap(),
            vec!["allow", "proto", "tcp", "from", "any", "to", "::/0", "port", "8080"]
        );
        assert!(ufw_allow_args(8080, "tcp", "bogus").is_err());
        assert!(ufw_allow_args(8080, "sctp", "v4").is_err());
    }
}

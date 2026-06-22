use crate::firewall::{FirewallRule, FirewallStatus};
use crate::remote::{self, RemoteOutput, Target};
use crate::ssh::SshStatus;

async fn run_priv(target: &Target, command: &str) -> Result<RemoteOutput, String> {
    if target.username == "root" {

        let with_path = format!("PATH=/usr/sbin:/sbin:/usr/local/sbin:$PATH {command}");
        remote::run_target(target, &with_path).await
    } else if let Some(pw) = &target.sudo_password {
        let full = format!("sudo -S -p '' {command}");
        remote::run_target_stdin(target, &full, format!("{pw}\n").as_bytes()).await
    } else {
        let full = format!("sudo -n {command}");
        remote::run_target(target, &full).await
    }
}

pub async fn docker_run(target: &Target, command: &str) -> Result<RemoteOutput, String> {
    let out = remote::run_target(target, command).await?;
    if out.code != 0 && is_docker_permission_error(&out.stderr) && target.username != "root" {
        return run_priv(target, command).await;
    }
    Ok(out)
}

fn is_docker_permission_error(stderr: &str) -> bool {
    let s = stderr.to_lowercase();
    s.contains("permission denied") && s.contains("docker.sock")
}

fn err_message(out: &RemoteOutput) -> String {
    if out.stderr.trim().is_empty() {
        format!("Commande distante en échec (code {}).", out.code)
    } else {
        out.stderr.trim().to_string()
    }
}

pub async fn docker_available(target: &Target) -> bool {
    remote::run_target(target, "docker --version")
        .await
        .map(|o| o.code == 0)
        .unwrap_or(false)
}

pub async fn firewall_status(target: &Target) -> FirewallStatus {
    let available = remote::run_target(
        target,
        "if command -v ufw >/dev/null 2>&1 || test -x /usr/sbin/ufw || test -x /sbin/ufw \
         || test -x /usr/local/sbin/ufw; then echo yes; else echo no; fi",
    )
    .await
    .map(|o| o.stdout.trim() == "yes")
    .unwrap_or(false);

    let enabled = if available {
        match run_priv(target, "ufw status 2>/dev/null | head -1").await {
            Ok(o) => {
                let s = o.stdout.to_lowercase();
                if s.contains("inactive") {
                    Some(false)
                } else if s.contains("active") {
                    Some(true)
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    } else {
        None
    };

    FirewallStatus {
        backend: "ufw".into(),
        available,
        manageable: available,
        enabled,
        needs_privileges: true,
        ip_versions: if available {
            vec!["v4".into(), "v6".into()]
        } else {
            Vec::new()
        },
        message: if available {
            None
        } else {
            Some("ufw n'est pas installé sur le serveur distant.".into())
        },
    }
}

pub async fn firewall_rules(target: &Target) -> Result<Vec<FirewallRule>, String> {
    let out = run_priv(target, "ufw status numbered").await?;
    if out.code != 0 && !out.stdout.contains('[') {
        return Err(err_message(&out));
    }
    Ok(crate::firewall::parse_ufw_rules(&out.stdout))
}

pub async fn firewall_open(
    target: &Target,
    port: u16,
    protocol: &str,
    ip_version: &str,
) -> Result<(), String> {
    let args = crate::firewall::ufw_allow_args(port, protocol, ip_version)?;
    let out = run_priv(target, &format!("ufw {}", args.join(" "))).await?;
    if out.code == 0 {
        Ok(())
    } else {
        Err(err_message(&out))
    }
}

pub async fn firewall_close(
    target: &Target,
    id: &str,
    _port: &str,
    _protocol: &str,
    _ip_version: &str,
) -> Result<(), String> {
    let num: u32 = id
        .parse()
        .map_err(|_| "Numéro de règle invalide.".to_string())?;
    let out = run_priv(target, &format!("ufw --force delete {num}")).await?;
    if out.code == 0 {
        Ok(())
    } else {
        Err(err_message(&out))
    }
}

pub async fn ssh_status(target: &Target) -> SshStatus {
    let cmd = "if test -f /etc/ssh/sshd_config; then echo INSTALLED; \
        (grep -E '^[[:space:]]*Port[[:space:]]+[0-9]+' /etc/ssh/sshd_config | grep -oE '[0-9]+' | head -1 || echo 22); \
        (systemctl is-active ssh 2>/dev/null || systemctl is-active sshd 2>/dev/null || echo unknown); fi";

    match remote::run_target(target, cmd).await {
        Ok(o) => {
            let lines: Vec<&str> = o.stdout.lines().map(|l| l.trim()).collect();
            if lines.first() == Some(&"INSTALLED") {
                SshStatus {
                    installed: true,
                    port: lines.get(1).and_then(|l| l.parse::<u16>().ok()),
                    running: lines.get(2).map(|l| *l == "active"),
                    manageable: true,
                    message: None,
                }
            } else {
                SshStatus {
                    installed: false,
                    port: None,
                    running: None,
                    manageable: false,
                    message: Some("OpenSSH serveur n'est pas installé sur le serveur distant.".into()),
                }
            }
        }
        Err(e) => SshStatus {
            installed: false,
            port: None,
            running: None,
            manageable: false,
            message: Some(e),
        },
    }
}

pub async fn ssh_set_port(target: &Target, port: u16) -> Result<(), String> {
    if !(1..=65535).contains(&port) {
        return Err("Le port doit être compris entre 1 et 65535.".into());
    }
    let inner = format!(
        "sed -i -E 's/^[[:space:]]*#?[[:space:]]*Port[[:space:]]+[0-9]+.*/Port {port}/' /etc/ssh/sshd_config; \
         grep -qE '^Port[[:space:]]+{port}$' /etc/ssh/sshd_config || echo 'Port {port}' >> /etc/ssh/sshd_config; \
         (command -v ufw >/dev/null 2>&1 && ufw allow {port}/tcp || true); \
         (systemctl restart ssh 2>/dev/null || systemctl restart sshd)"
    );
    let out = run_priv(target, &format!("sh -c \"{inner}\"")).await?;
    if out.code == 0 {
        Ok(())
    } else {
        Err(err_message(&out))
    }
}

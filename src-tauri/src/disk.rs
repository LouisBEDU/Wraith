use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct DiskUsage {
    pub total: u64,
    pub available: u64,
}

pub fn parse_df(raw: &str) -> Option<DiskUsage> {
    let line = raw.lines().filter(|l| !l.trim().is_empty()).next_back()?;
    let cols: Vec<&str> = line.split_whitespace().collect();
    if cols.len() < 4 {
        return None;
    }
    let blocks: u64 = cols[1].parse().ok()?;
    let available: u64 = cols[3].parse().ok()?;
    Some(DiskUsage {
        total: blocks.saturating_mul(1024),
        available: available.saturating_mul(1024),
    })
}

#[cfg(target_os = "windows")]
pub fn local() -> Result<DiskUsage, String> {
    let out = crate::winproc::run_powershell(
        "$d = Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='$env:SystemDrive'\"; \
         [Console]::Out.Write(\"$($d.FreeSpace) $($d.Size)\")",
    )?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    let mut parts = stdout.split_whitespace();
    let parse = |v: Option<&str>| v.and_then(|s| s.parse::<u64>().ok());
    match (parse(parts.next()), parse(parts.next())) {
        (Some(available), Some(total)) => Ok(DiskUsage { total, available }),
        _ => Err("Lecture de l'espace disque impossible.".into()),
    }
}

#[cfg(not(target_os = "windows"))]
pub fn local() -> Result<DiskUsage, String> {
    let out = std::process::Command::new("df")
        .args(["-kP", "/"])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    parse_df(&String::from_utf8_lossy(&out.stdout))
        .ok_or_else(|| "Lecture de l'espace disque impossible.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_df_output() {
        let raw = "Filesystem     1024-blocks      Used  Available Capacity Mounted on\n\
                   /dev/sda1         40000000  20000000   18000000      53% /\n";
        let usage = parse_df(raw).unwrap();
        assert_eq!(usage.total, 40_000_000 * 1024);
        assert_eq!(usage.available, 18_000_000 * 1024);
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse_df("").is_none());
        assert!(parse_df("not a df output").is_none());
    }
}

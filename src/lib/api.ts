import { invoke } from "@tauri-apps/api/core";
import type { FirewallRule, SystemTools } from "../types/firewall";
import type { ConnectionProfile, ConnectionSaveInput } from "../types/connection";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type WebServerSettings = {
  enabled: boolean;
  port: number;
  has_password: boolean;
  run_in_background: boolean;
};

export type WebServerSettingsInput = {
  enabled: boolean;
  port: number;
  password: string | null;
  run_in_background: boolean;
};

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`/api${path}`, options);
  if (res.status === 401) {
    window.dispatchEvent(new Event("wraith:unauthorized"));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Erreur ${res.status}`);
  }
  return res;
}

async function apiFetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(path, options);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      "Réponse inattendue du serveur (pas du JSON). Si tu es sur le port 1420, " +
        "c'est le serveur de dev Vite : utilise la fenêtre desktop (npm run tauri dev) " +
        "ou le port du serveur web configuré dans Paramètres.",
    );
  }
}

export async function dockerPs(): Promise<string> {
  if (isTauri) {
    return invoke<string>("docker_ps");
  }
  const data = await apiFetchJson<{ raw: string }>("/containers");
  return data.raw;
}

export type ContainerAction = "start" | "stop" | "restart" | "remove";

const ACTION_COMMAND: Record<ContainerAction, string> = {
  start: "docker_start",
  stop: "docker_stop",
  restart: "docker_restart",
  remove: "docker_remove",
};

export async function dockerAction(action: ContainerAction, id: string): Promise<void> {
  if (isTauri) {
    await invoke(ACTION_COMMAND[action], { id });
    return;
  }

  if (action === "remove") {
    await apiFetch(`/containers/${encodeURIComponent(id)}`, { method: "DELETE" });
  } else {
    await apiFetch(`/containers/${encodeURIComponent(id)}/${action}`, { method: "POST" });
  }
}

export async function dockerLogs(id: string): Promise<string> {
  if (isTauri) {
    return invoke<string>("docker_logs", { id });
  }
  const data = await apiFetchJson<{ raw: string }>(`/containers/${encodeURIComponent(id)}/logs`);
  return data.raw;
}

// ─── Images ───

export async function dockerImages(): Promise<string> {
  if (isTauri) return invoke<string>("docker_images");
  const data = await apiFetchJson<{ raw: string }>("/images");
  return data.raw;
}

export async function dockerImageRemove(id: string): Promise<void> {
  if (isTauri) {
    await invoke("docker_image_remove", { id });
    return;
  }
  await apiFetch(`/images/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function dockerImagePrune(): Promise<void> {
  if (isTauri) {
    await invoke("docker_image_prune");
    return;
  }
  await apiFetch("/images/prune", { method: "POST" });
}

// ─── Volumes ───

export async function dockerVolumes(): Promise<string> {
  if (isTauri) return invoke<string>("docker_volumes");
  const data = await apiFetchJson<{ raw: string }>("/volumes");
  return data.raw;
}

export async function dockerVolumeRemove(name: string): Promise<void> {
  if (isTauri) {
    await invoke("docker_volume_remove", { name });
    return;
  }
  await apiFetch(`/volumes/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export async function dockerVolumePrune(): Promise<void> {
  if (isTauri) {
    await invoke("docker_volume_prune");
    return;
  }
  await apiFetch("/volumes/prune", { method: "POST" });
}

// ─── Réseaux ───

export async function dockerNetworks(): Promise<string> {
  if (isTauri) return invoke<string>("docker_networks");
  const data = await apiFetchJson<{ raw: string }>("/networks");
  return data.raw;
}

export async function dockerNetworkRemove(id: string): Promise<void> {
  if (isTauri) {
    await invoke("docker_network_remove", { id });
    return;
  }
  await apiFetch(`/networks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function dockerNetworkPrune(): Promise<void> {
  if (isTauri) {
    await invoke("docker_network_prune");
    return;
  }
  await apiFetch("/networks/prune", { method: "POST" });
}

export async function getWebServerSettings(): Promise<WebServerSettings> {
  return invoke<WebServerSettings>("get_web_server_settings");
}

export async function saveWebServerSettings(settings: WebServerSettingsInput): Promise<void> {
  await invoke("save_web_server_settings", { settings });
}

export async function getLocalIp(): Promise<string> {
  return invoke<string>("get_local_ip");
}

export type DiskUsage = {
  total: number;
  available: number;
};

export async function getDiskUsage(): Promise<DiskUsage> {
  if (isTauri) return invoke<DiskUsage>("disk_usage");
  return apiFetchJson<DiskUsage>("/disk");
}

export async function login(password: string): Promise<boolean> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({ ok: false }));
  return Boolean(data.ok);
}

export async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/session");
    const data = await res.json();
    return Boolean(data.authenticated);
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
}

export async function getSystemTools(): Promise<SystemTools> {
  return invoke<SystemTools>("system_tools");
}

export async function getFirewallRules(): Promise<FirewallRule[]> {
  return invoke<FirewallRule[]>("firewall_rules");
}

export async function openFirewallPort(
  port: number,
  protocol: string,
  ipVersion = "any",
): Promise<void> {
  await invoke("firewall_open_port", { port, protocol, ipVersion });
}

export async function closeFirewallRule(rule: FirewallRule): Promise<void> {
  await invoke("firewall_close_rule", {
    id: rule.id,
    port: rule.port,
    protocol: rule.protocol,
    ipVersion: rule.ip_version,
  });
}

export async function setSshPort(port: number): Promise<void> {
  await invoke("ssh_set_port", { port });
}

export type ConnectionTestInput = {
  host: string;
  port: number;
  username: string;
  authMethod: "key" | "password";
  secret: string | null;
  keyPath: string | null;
};

export async function testConnection(input: ConnectionTestInput): Promise<string> {
  return invoke<string>("connection_test", {
    host: input.host,
    port: input.port,
    username: input.username,
    authMethod: input.authMethod,
    secret: input.secret,
    keyPath: input.keyPath,
  });
}

export async function listConnections(): Promise<ConnectionProfile[]> {
  return invoke<ConnectionProfile[]>("connections_list");
}

export async function saveConnection(input: ConnectionSaveInput): Promise<ConnectionProfile> {
  return invoke<ConnectionProfile>("connection_save", {
    input: {
      id: input.id ?? null,
      name: input.name,
      host: input.host,
      port: input.port,
      username: input.username,
      auth_method: input.authMethod,
      key_path: input.keyPath,
      secret: input.secret,
      sudo_password: input.sudoPassword,
    },
  });
}

export async function deleteConnection(id: string): Promise<void> {
  await invoke("connection_delete", { id });
}

export async function setActiveConnection(id: string | null): Promise<void> {
  await invoke("set_active_connection", { id });
}

export async function getActiveConnection(): Promise<string | null> {
  return invoke<string | null>("get_active_connection");
}

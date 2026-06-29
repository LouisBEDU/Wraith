import { invoke } from "@tauri-apps/api/core";
import type { FirewallRule, SystemTools } from "../types/firewall";
import type { ConnectionProfile, ConnectionSaveInput } from "../types/connection";

export async function dockerPs(): Promise<string> {
  return invoke<string>("docker_ps");
}

export type ContainerAction = "start" | "stop" | "restart" | "remove";

const ACTION_COMMAND: Record<ContainerAction, string> = {
  start: "docker_start",
  stop: "docker_stop",
  restart: "docker_restart",
  remove: "docker_remove",
};

export async function dockerAction(action: ContainerAction, id: string): Promise<void> {
  await invoke(ACTION_COMMAND[action], { id });
}

export async function dockerLogs(id: string): Promise<string> {
  return invoke<string>("docker_logs", { id });
}

export type ExecOutput = {
  stdout: string;
  stderr: string;
  code: number;
};

export async function dockerExecCommand(
  id: string,
  shell: string,
  command: string,
): Promise<ExecOutput> {
  return invoke<ExecOutput>("docker_exec_command", { id, shell, command });
}

export async function consoleOpen(containerId: string, shell: string): Promise<string> {
  return invoke<string>("console_open", { containerId, shell });
}

export async function consoleExec(id: string, command: string): Promise<ExecOutput> {
  return invoke<ExecOutput>("console_exec", { id, command });
}

export async function consoleClose(id: string): Promise<void> {
  await invoke("console_close", { id });
}

export type AttachOutput = {
  id: string;
  data: string;
  err: boolean;
};

export async function attachOpen(containerId: string): Promise<string> {
  return invoke<string>("attach_open", { containerId });
}

export async function attachWrite(id: string, data: string): Promise<void> {
  await invoke("attach_write", { id, data });
}

export async function attachClose(id: string): Promise<void> {
  await invoke("attach_close", { id });
}

export async function containerAttachable(id: string): Promise<boolean> {
  return invoke<boolean>("container_attachable", { id });
}

// ─── Images ───

export async function dockerImages(): Promise<string> {
  return invoke<string>("docker_images");
}

export async function dockerImageRemove(id: string): Promise<void> {
  await invoke("docker_image_remove", { id });
}

export async function dockerImagePrune(): Promise<void> {
  await invoke("docker_image_prune");
}

// ─── Volumes ───

export async function dockerVolumes(): Promise<string> {
  return invoke<string>("docker_volumes");
}

export async function dockerVolumeRemove(name: string): Promise<void> {
  await invoke("docker_volume_remove", { name });
}

export async function dockerVolumePrune(): Promise<void> {
  await invoke("docker_volume_prune");
}

// ─── Réseaux ───

export async function dockerNetworks(): Promise<string> {
  return invoke<string>("docker_networks");
}

export async function dockerNetworkRemove(id: string): Promise<void> {
  await invoke("docker_network_remove", { id });
}

export async function dockerNetworkPrune(): Promise<void> {
  await invoke("docker_network_prune");
}

export type DiskUsage = {
  total: number;
  available: number;
};

export async function getDiskUsage(): Promise<DiskUsage> {
  return invoke<DiskUsage>("disk_usage");
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

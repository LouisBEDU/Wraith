import { invoke } from "@tauri-apps/api/core";

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

export async function getWebServerSettings(): Promise<WebServerSettings> {
  return invoke<WebServerSettings>("get_web_server_settings");
}

export async function saveWebServerSettings(settings: WebServerSettingsInput): Promise<void> {
  await invoke("save_web_server_settings", { settings });
}

export async function getLocalIp(): Promise<string> {
  return invoke<string>("get_local_ip");
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

import { invoke } from "@tauri-apps/api/core";

/**
 * true si l'app tourne dans la vraie fenêtre desktop Tauri (où `invoke()`
 * fonctionne). false si elle est servie par le serveur web embarqué et
 * consultée depuis un navigateur classique — dans ce cas on passe par
 * fetch() vers l'API REST exposée par web_server.rs.
 */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type WebServerSettings = {
  enabled: boolean;
  port: number;
  password: string;
};

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`/api${path}`, options);
  if (res.status === 401) {
    // Session expirée ou jamais ouverte : on prévient l'app pour qu'elle
    // réaffiche l'écran de connexion au lieu d'un message d'erreur brut.
    window.dispatchEvent(new Event("wraith:unauthorized"));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Erreur ${res.status}`);
  }
  return res;
}

// Si /api/* renvoie autre chose que du JSON (ex: la page index.html, parce
// qu'on a ouvert le serveur de dev Vite (port 1420) dans un navigateur
// classique au lieu de la vraie fenêtre Tauri ou du serveur web embarqué
// sur 1825), `res.json()` plante avec un SyntaxError cryptique. On détecte
// ce cas pour donner un message clair à la place.
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

// Les paramètres du serveur web ne sont modifiables que depuis l'app
// desktop (ça n'aurait pas de sens de les changer depuis le navigateur
// qui dépend justement de ce serveur).

export async function getWebServerSettings(): Promise<WebServerSettings> {
  return invoke<WebServerSettings>("get_web_server_settings");
}

export async function saveWebServerSettings(settings: WebServerSettings): Promise<void> {
  await invoke("save_web_server_settings", { settings });
}

export async function getLocalIp(): Promise<string> {
  return invoke<string>("get_local_ip");
}

// Authentification de l'accès web (mode navigateur uniquement). Le serveur
// embarqué gère ça par cookie de session, pas par l'auth HTTP Basic
// native du navigateur — ça permet un écran de connexion custom (joli) à
// la place du popup natif (moche).

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

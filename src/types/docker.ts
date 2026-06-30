export interface DockerContainer {
  ID: string;
  Image: string;
  Names: string;
  Ports: string;
  State: string;
  Status: string;
  RunningFor: string;
  Labels?: string;
}

const COMPOSE_PROJECT_LABEL = "com.docker.compose.project";

export function composeProject(container: DockerContainer): string | null {
  const labels = container.Labels;
  if (!labels) return null;
  for (const pair of labels.split(",")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() === COMPOSE_PROJECT_LABEL) {
      const value = pair.slice(eq + 1).trim();
      return value || null;
    }
  }
  return null;
}

function parseNdjson<T>(raw: string): T[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    })
    .filter((item): item is T => item !== null);
}

export function parseDockerPs(raw: string): DockerContainer[] {
  return parseNdjson<DockerContainer>(raw);
}

export interface DockerImage {
  ID: string;
  Repository: string;
  Tag: string;
  Size: string;
  CreatedSince: string;
}

export function parseDockerImages(raw: string): DockerImage[] {
  return parseNdjson<DockerImage>(raw);
}

export interface DockerVolume {
  Name: string;
  Driver: string;
  Mountpoint: string;
  Scope: string;
}

export function parseDockerVolumes(raw: string): DockerVolume[] {
  return parseNdjson<DockerVolume>(raw);
}

export interface DockerNetwork {
  ID: string;
  Name: string;
  Driver: string;
  Scope: string;
}

export const PROTECTED_NETWORKS = new Set(["bridge", "host", "none"]);

export function parseDockerNetworks(raw: string): DockerNetwork[] {
  return parseNdjson<DockerNetwork>(raw);
}

export interface DockerContainer {
  ID: string;
  Image: string;
  Names: string;
  Ports: string;
  State: string;
  Status: string;
  RunningFor: string;
}

export function parseDockerPs(raw: string): DockerContainer[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as DockerContainer;
      } catch {
        return null;
      }
    })
    .filter((container): container is DockerContainer => container !== null);
}

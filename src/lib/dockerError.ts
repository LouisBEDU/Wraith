import type { TFunction } from "i18next";

const DAEMON_DOWN_PATTERNS = [
  /cannot connect to the docker daemon/i,
  /failed to connect to the docker api/i,
  /is the docker daemon running/i,
  /dockerdesktoplinuxengine/i,
  /open \/\/\.\/pipe\//i,
  /the system cannot find the file specified/i,
  /le fichier spécifié est introuvable/i,
];

const NOT_FOUND_PATTERNS = [/no such container/i, /not found/i];

const IN_USE_PATTERNS = [
  /volume is in use/i,
  /image is being used/i,
  /has active endpoints/i,
  /is being used by (?:running|stopped) container/i,
];

export function friendlyDockerError(err: unknown, t: TFunction): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (DAEMON_DOWN_PATTERNS.some((p) => p.test(raw))) {
    return t("dockerError.daemonDown");
  }

  if (IN_USE_PATTERNS.some((p) => p.test(raw))) {
    return t("dockerError.resourceInUse");
  }

  if (NOT_FOUND_PATTERNS.some((p) => p.test(raw))) {
    return t("dockerError.containerNotFound");
  }

  return raw.trim() || t("dockerError.generic");
}

import type { TFunction } from "i18next";

const DURATION_UNIT = /^(\d+)\s+(second|minute|hour|day|week|month|year)s?$/i;

function translateDuration(duration: string, t: TFunction): string {
  const trimmed = duration.trim();

  if (/^less than a second$/i.test(trimmed)) return t("statusDetail.duration.lessThanASecond");
  if (/^about a minute$/i.test(trimmed)) return t("statusDetail.duration.aboutAMinute");
  if (/^about an hour$/i.test(trimmed)) return t("statusDetail.duration.aboutAnHour");

  const match = trimmed.match(DURATION_UNIT);
  if (match) {
    const count = Number(match[1]);
    const unit = match[2].toLowerCase();
    return t(`statusDetail.duration.${unit}`, { count });
  }

  return duration;
}

const SUFFIX_KEYS: Record<string, string> = {
  healthy: "statusDetail.suffix.healthy",
  unhealthy: "statusDetail.suffix.unhealthy",
  paused: "statusDetail.suffix.paused",
};

function translateSuffix(inner: string, t: TFunction): string {
  if (/^health:\s*starting$/i.test(inner)) {
    return `(${t("statusDetail.suffix.healthStarting")})`;
  }
  const key = SUFFIX_KEYS[inner.toLowerCase()];
  return key ? `(${t(key)})` : `(${inner})`;
}

const EXACT_STATUS_KEYS: Record<string, string> = {
  created: "statusDetail.created",
  paused: "statusDetail.paused",
  removing: "statusDetail.removing",
  dead: "statusDetail.dead",
};

const UP_PATTERN = /^Up\s+(.+?)(?:\s+\(([^)]+)\))?$/i;
const EXITED_PATTERN = /^Exited\s+\((-?\d+)\)\s+(.+?)\s+ago$/i;
const RESTARTING_PATTERN = /^Restarting\s+\((-?\d+)\)\s+(.+?)\s+ago$/i;

export function translateDockerStatus(status: string, t: TFunction): string {
  if (!status) return status;

  const exactKey = EXACT_STATUS_KEYS[status.trim().toLowerCase()];
  if (exactKey) return t(exactKey);

  const upMatch = status.match(UP_PATTERN);
  if (upMatch) {
    const duration = translateDuration(upMatch[1], t);
    const suffix = upMatch[2] ? ` ${translateSuffix(upMatch[2], t)}` : "";
    return `${t("statusDetail.up")} ${duration}${suffix}`;
  }

  const exitedMatch = status.match(EXITED_PATTERN);
  if (exitedMatch) {
    const duration = translateDuration(exitedMatch[2], t);
    return t("statusDetail.exited", { code: exitedMatch[1], duration });
  }

  const restartingMatch = status.match(RESTARTING_PATTERN);
  if (restartingMatch) {
    const duration = translateDuration(restartingMatch[2], t);
    return t("statusDetail.restarting", { code: restartingMatch[1], duration });
  }

  return status;
}

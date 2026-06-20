import { useTranslation } from "react-i18next";

type StatusBadgeProps = {
  state: string;
  status: string;
};

const STATE_CLASS: Record<string, string> = {
  running: "badge-running",
  exited: "badge-stopped",
  created: "badge-stopped",
  paused: "badge-restarting",
  restarting: "badge-restarting",
  removing: "badge-error",
  dead: "badge-error",
};

export default function StatusBadge({ state, status }: StatusBadgeProps) {
  const { t } = useTranslation();
  const className = STATE_CLASS[state] ?? "badge-stopped";
  const label = STATE_CLASS[state] ? t(`status.${state}`) : status;

  return (
    <span className={`badge ${className}`} title={status}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

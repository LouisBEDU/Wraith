type StatusBadgeProps = {
  state: string;
  status: string;
};

const STATE_CONFIG: Record<string, { className: string; label: string }> = {
  running: { className: "badge-running", label: "En cours" },
  exited: { className: "badge-stopped", label: "Arrêté" },
  created: { className: "badge-stopped", label: "Créé" },
  paused: { className: "badge-restarting", label: "En pause" },
  restarting: { className: "badge-restarting", label: "Redémarre" },
  removing: { className: "badge-error", label: "Suppression" },
  dead: { className: "badge-error", label: "Mort" },
};

export default function StatusBadge({ state, status }: StatusBadgeProps) {
  const config = STATE_CONFIG[state] ?? { className: "badge-stopped", label: status };

  return (
    <span className={`badge ${config.className}`} title={status}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}

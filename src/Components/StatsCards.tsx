import type { DockerContainer } from "../types/docker";
import { ContainersIcon, PlayIcon, StopIcon } from "./icons";

type StatsCardsProps = {
  containers: DockerContainer[];
};

export default function StatsCards({ containers }: StatsCardsProps) {
  const total = containers.length;
  const running = containers.filter((c) => c.State === "running").length;
  const stopped = total - running;

  const stats = [
    { label: "Conteneurs", value: total, icon: ContainersIcon, accent: "text-anthracite-900 bg-anthracite-100" },
    { label: "En cours", value: running, icon: PlayIcon, accent: "text-status-running bg-status-running-soft" },
    { label: "Arrêtés", value: stopped, icon: StopIcon, accent: "text-status-stopped bg-status-stopped-soft" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map(({ label, value, icon: Icon, accent }) => (
        <div key={label} className="card p-5 flex items-center gap-4 min-w-0">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-semibold leading-none text-anthracite-900">{value}</p>
            <p className="text-sm text-anthracite-500 mt-1">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

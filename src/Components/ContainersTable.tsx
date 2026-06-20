import type { DockerContainer } from "../types/docker";
import StatusBadge from "./StatusBadge";
import { ContainersIcon, PlayIcon, RestartIcon, StopIcon, TrashIcon } from "./icons";

export type ContainerAction = "start" | "stop" | "restart" | "remove";

type ContainersTableProps = {
  containers: DockerContainer[];
  pendingId: string | null;
  onAction: (container: DockerContainer, action: ContainerAction) => void;
};

export default function ContainersTable({ containers, pendingId, onAction }: ContainersTableProps) {
  if (containers.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 py-16 text-anthracite-400">
        <ContainersIcon className="h-9 w-9" />
        <p className="text-sm">Aucun conteneur chargé. Cliquez sur « Actualiser ».</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-anthracite-50 text-left text-xs uppercase tracking-wide text-anthracite-500">
              <th className="px-5 py-3 font-medium">Nom</th>
              <th className="px-5 py-3 font-medium">Image</th>
              <th className="px-5 py-3 font-medium">Statut</th>
              <th className="hidden md:table-cell px-5 py-3 font-medium">Ports</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-anthracite-100">
            {containers.map((container) => {
              const isRunning = container.State === "running";
              const isPending = pendingId === container.ID;

              return (
                <tr key={container.ID} className="hover:bg-paper-dim transition-colors">
                  <td className="px-5 py-3 font-medium text-anthracite-900">{container.Names}</td>
                  <td className="px-5 py-3 text-anthracite-500">{container.Image}</td>
                  <td className="px-5 py-3">
                    <StatusBadge state={container.State} status={container.Status} />
                  </td>
                  <td className="hidden md:table-cell px-5 py-3 text-anthracite-500">{container.Ports || "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="Démarrer"
                        className="icon-btn"
                        disabled={isRunning || isPending}
                        onClick={() => onAction(container, "start")}
                      >
                        <PlayIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Arrêter"
                        className="icon-btn"
                        disabled={!isRunning || isPending}
                        onClick={() => onAction(container, "stop")}
                      >
                        <StopIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Redémarrer"
                        className="icon-btn"
                        disabled={isPending}
                        onClick={() => onAction(container, "restart")}
                      >
                        <RestartIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Supprimer"
                        className="icon-btn hover:!bg-status-error-soft hover:!text-status-error"
                        disabled={isPending}
                        onClick={() => onAction(container, "remove")}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

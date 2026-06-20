import { useTranslation } from "react-i18next";
import type { DockerContainer } from "../types/docker";
import StatusBadge from "./StatusBadge";
import { ContainersIcon, PlayIcon, RestartIcon, StopIcon, TerminalIcon, TrashIcon } from "./icons";

export type ContainerAction = "start" | "stop" | "restart" | "remove";

type ContainersTableProps = {
  containers: DockerContainer[];
  pendingId: string | null;
  onAction: (container: DockerContainer, action: ContainerAction) => void;
  onShowLogs: (container: DockerContainer) => void;
};

export default function ContainersTable({
  containers,
  pendingId,
  onAction,
  onShowLogs,
}: ContainersTableProps) {
  const { t } = useTranslation();

  if (containers.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 py-16 text-anthracite-400">
        <ContainersIcon className="h-9 w-9" />
        <p className="text-sm">{t("table.empty")}</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr className="bg-anthracite-50 text-left text-xs uppercase tracking-wide text-anthracite-500">
              <th className="px-5 py-3 font-medium">{t("table.name")}</th>
              <th className="px-5 py-3 font-medium">{t("table.image")}</th>
              <th className="px-5 py-3 font-medium">{t("table.status")}</th>
              <th className="hidden md:table-cell px-5 py-3 font-medium">{t("table.ports")}</th>
              <th className="px-5 py-3 font-medium text-right">{t("table.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-anthracite-100">
            {containers.map((container) => {
              const isRunning = container.State === "running";
              const isPending = pendingId === container.ID;

              return (
                <tr key={container.ID} className="hover:bg-paper-dim transition-colors">
                  <td className="px-5 py-3 font-medium text-anthracite-900">
                    <div className="max-w-48 truncate select-none" title={container.Names}>
                      {container.Names}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-anthracite-500">
                    <div className="max-w-56 truncate select-none" title={container.Image}>
                      {container.Image}
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <StatusBadge state={container.State} status={container.Status} />
                  </td>
                  <td className="hidden md:table-cell px-5 py-3 text-anthracite-500">
                    <div className="max-w-40 truncate select-none" title={container.Ports || "—"}>
                      {container.Ports || "—"}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title={t("table.logs")}
                        className="icon-btn"
                        onClick={() => onShowLogs(container)}
                      >
                        <TerminalIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title={t("table.start")}
                        className="icon-btn"
                        disabled={isRunning || isPending}
                        onClick={() => onAction(container, "start")}
                      >
                        <PlayIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title={t("table.stop")}
                        className="icon-btn"
                        disabled={!isRunning || isPending}
                        onClick={() => onAction(container, "stop")}
                      >
                        <StopIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title={t("table.restart")}
                        className="icon-btn"
                        disabled={isPending}
                        onClick={() => onAction(container, "restart")}
                      >
                        <RestartIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title={t("table.remove")}
                        className="icon-btn hover:bg-status-error-soft! hover:text-status-error!"
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

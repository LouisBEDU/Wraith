import { useTranslation } from "react-i18next";
import type { DockerContainer } from "../types/docker";
import StatusBadge from "./StatusBadge";
import DataTable, { type DataTableColumn } from "./DataTable";
import {
  ContainersIcon,
  LogsIcon,
  PlayIcon,
  RestartIcon,
  StopIcon,
  TerminalIcon,
  TrashIcon,
} from "./icons";

export type ContainerAction = "start" | "stop" | "restart" | "remove";

type ContainersTableProps = {
  containers: DockerContainer[];
  pendingId: string | null;
  loading?: boolean;
  onAction: (container: DockerContainer, action: ContainerAction) => void;
  onShowLogs: (container: DockerContainer) => void;
  onOpenConsole: (container: DockerContainer) => void;
};

export default function ContainersTable({
  containers,
  pendingId,
  loading = false,
  onAction,
  onShowLogs,
  onOpenConsole,
}: ContainersTableProps) {
  const { t } = useTranslation();

  const columns: DataTableColumn<DockerContainer>[] = [
    {
      id: "name",
      header: t("table.name"),
      cell: (c) => (
        <div className="max-w-48 truncate select-none text-anthracite-900" title={c.Names}>
          {c.Names}
        </div>
      ),
    },
    {
      id: "image",
      header: t("table.image"),
      cell: (c) => (
        <div className="max-w-56 truncate select-none text-anthracite-500" title={c.Image}>
          {c.Image}
        </div>
      ),
    },
    {
      id: "status",
      header: t("table.status"),
      className: "whitespace-nowrap",
      cell: (c) => <StatusBadge state={c.State} status={c.Status} />,
    },
    {
      id: "ports",
      header: t("table.ports"),
      className: "hidden md:table-cell",
      cell: (c) => (
        <div className="max-w-40 truncate select-none text-anthracite-500" title={c.Ports || "—"}>
          {c.Ports || "—"}
        </div>
      ),
    },
    {
      id: "actions",
      header: t("table.actions"),
      align: "right",
      className: "whitespace-nowrap",
      cell: (c) => {
        const isRunning = c.State === "running";
        const isPending = pendingId === c.ID;
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              title={t("table.logs")}
              className="icon-btn"
              onClick={() => onShowLogs(c)}
            >
              <LogsIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={isRunning ? t("table.console") : t("table.consoleUnavailable")}
              className="icon-btn"
              disabled={!isRunning || isPending}
              onClick={() => onOpenConsole(c)}
            >
              <TerminalIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={t("table.start")}
              className="icon-btn"
              disabled={isRunning || isPending}
              onClick={() => onAction(c, "start")}
            >
              <PlayIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={t("table.stop")}
              className="icon-btn"
              disabled={!isRunning || isPending}
              onClick={() => onAction(c, "stop")}
            >
              <StopIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={t("table.restart")}
              className="icon-btn"
              disabled={isPending}
              onClick={() => onAction(c, "restart")}
            >
              <RestartIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={t("table.remove")}
              className="icon-btn hover:bg-status-error-soft! hover:text-status-error!"
              disabled={isPending}
              onClick={() => onAction(c, "remove")}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={containers}
      rowKey={(c) => c.ID}
      loading={loading}
      minWidth="min-w-160"
      empty={
        <>
          <ContainersIcon className="h-9 w-9" />
          <p className="text-sm">{t("table.empty")}</p>
        </>
      }
    />
  );
}

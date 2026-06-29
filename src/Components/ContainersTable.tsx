import { useTranslation } from "react-i18next";
import type { DockerContainer } from "../types/docker";
import StatusBadge from "./StatusBadge";
import DataTable, { type DataTableColumn } from "./DataTable";
import type { ContextMenuItem } from "./ContextMenu";
import Tooltip from "./Tooltip";
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
        <div className="max-w-48 truncate text-anthracite-900" title={c.Names}>
          {c.Names}
        </div>
      ),
    },
    {
      id: "image",
      header: t("table.image"),
      cell: (c) => (
        <div className="max-w-56 truncate text-anthracite-500" title={c.Image}>
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
        <div className="max-w-40 truncate text-anthracite-500" title={c.Ports || "—"}>
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
            <Tooltip label={t("table.logs")}>
              <button type="button" className="icon-btn" onClick={() => onShowLogs(c)}>
                <LogsIcon className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip label={isRunning ? t("table.console") : t("table.consoleUnavailable")}>
              <button
                type="button"
                className="icon-btn"
                disabled={!isRunning || isPending}
                onClick={() => onOpenConsole(c)}
              >
                <TerminalIcon className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip label={t("table.start")}>
              <button
                type="button"
                className="icon-btn"
                disabled={isRunning || isPending}
                onClick={() => onAction(c, "start")}
              >
                <PlayIcon className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip label={t("table.stop")}>
              <button
                type="button"
                className="icon-btn"
                disabled={!isRunning || isPending}
                onClick={() => onAction(c, "stop")}
              >
                <StopIcon className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip label={t("table.restart")}>
              <button
                type="button"
                className="icon-btn"
                disabled={isPending}
                onClick={() => onAction(c, "restart")}
              >
                <RestartIcon className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip label={t("table.remove")}>
              <button
                type="button"
                className="icon-btn hover:bg-status-error-soft! hover:text-status-error!"
                disabled={isPending}
                onClick={() => onAction(c, "remove")}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  const rowActions = (c: DockerContainer): ContextMenuItem[] => {
    const isRunning = c.State === "running";
    const isPending = pendingId === c.ID;
    return [
      {
        id: "logs",
        label: t("table.logs"),
        icon: <LogsIcon className="h-4 w-4" />,
        onSelect: () => onShowLogs(c),
      },
      {
        id: "console",
        label: t("table.console"),
        icon: <TerminalIcon className="h-4 w-4" />,
        disabled: !isRunning || isPending,
        onSelect: () => onOpenConsole(c),
      },
      { type: "separator" },
      {
        id: "start",
        label: t("table.start"),
        icon: <PlayIcon className="h-4 w-4" />,
        disabled: isRunning || isPending,
        onSelect: () => onAction(c, "start"),
      },
      {
        id: "stop",
        label: t("table.stop"),
        icon: <StopIcon className="h-4 w-4" />,
        disabled: !isRunning || isPending,
        onSelect: () => onAction(c, "stop"),
      },
      {
        id: "restart",
        label: t("table.restart"),
        icon: <RestartIcon className="h-4 w-4" />,
        disabled: isPending,
        onSelect: () => onAction(c, "restart"),
      },
      { type: "separator" },
      {
        id: "remove",
        label: t("table.remove"),
        icon: <TrashIcon className="h-4 w-4" />,
        danger: true,
        disabled: isPending,
        onSelect: () => onAction(c, "remove"),
      },
    ];
  };

  return (
    <DataTable
      columns={columns}
      rows={containers}
      rowKey={(c) => c.ID}
      loading={loading}
      rowActions={rowActions}
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

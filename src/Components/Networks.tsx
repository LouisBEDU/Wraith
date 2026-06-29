import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { dockerNetworkPrune, dockerNetworkRemove, dockerNetworks } from "../lib/api";
import { parseDockerNetworks, PROTECTED_NETWORKS, type DockerNetwork } from "../types/docker";
import type { DataTableColumn } from "./DataTable";
import ResourcePage from "./ResourcePage";
import Tooltip from "./Tooltip";
import { NetworksIcon, TrashIcon } from "./icons";

export default function Networks() {
  const { t } = useTranslation();

  const load = useCallback(async () => parseDockerNetworks(await dockerNetworks()), []);

  const columns = useCallback(
    ({
      pendingKey,
      requestRemove,
    }: {
      pendingKey: string | null;
      requestRemove: (row: DockerNetwork) => void;
    }): DataTableColumn<DockerNetwork>[] => [
      {
        id: "name",
        header: t("networks.colName"),
        cell: (net) => (
          <div className="max-w-72 truncate text-anthracite-900" title={net.Name}>
            {net.Name}
          </div>
        ),
      },
      {
        id: "id",
        header: t("networks.colId"),
        className: "whitespace-nowrap hidden sm:table-cell",
        cell: (net) => (
          <span className="font-mono text-xs text-anthracite-500">{net.ID.slice(0, 12)}</span>
        ),
      },
      {
        id: "driver",
        header: t("networks.colDriver"),
        className: "whitespace-nowrap",
        cell: (net) => <span className="text-anthracite-500">{net.Driver}</span>,
      },
      {
        id: "scope",
        header: t("networks.colScope"),
        className: "whitespace-nowrap hidden md:table-cell",
        cell: (net) => <span className="text-anthracite-500">{net.Scope}</span>,
      },
      {
        id: "actions",
        header: t("networks.colActions"),
        align: "right",
        className: "whitespace-nowrap",
        cell: (net) => {
          const protectedNet = PROTECTED_NETWORKS.has(net.Name);
          return (
            <div className="flex items-center justify-end">
              {protectedNet ? (
                <span className="badge badge-stopped">{t("networks.systemBadge")}</span>
              ) : (
                <Tooltip label={t("networks.remove")}>
                  <button
                    type="button"
                    className="icon-btn hover:bg-status-error-soft! hover:text-status-error!"
                    disabled={pendingKey === net.ID}
                    onClick={() => requestRemove(net)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    [t],
  );

  return (
    <ResourcePage<DockerNetwork>
      name="networks"
      title={t("networks.title")}
      subtitle={t("networks.subtitle")}
      load={load}
      rowKey={(net) => net.ID}
      columns={columns}
      minWidth="min-w-160"
      emptyIcon={<NetworksIcon className="h-9 w-9" />}
      emptyLabel={t("networks.empty")}
      remove={{
        run: (net) => dockerNetworkRemove(net.ID),
        title: t("networks.removeTitle"),
        description: (net) => t("networks.removeDescription", { name: net.Name }),
        confirmLabel: t("networks.remove"),
        successToast: (net) => t("networks.toastRemoved", { name: net.Name }),
      }}
      prune={{
        buttonLabel: t("networks.prune"),
        title: t("networks.pruneTitle"),
        description: t("networks.pruneDescription"),
        confirmLabel: t("networks.prune"),
        run: dockerNetworkPrune,
        successToast: t("networks.toastPruned"),
      }}
    />
  );
}

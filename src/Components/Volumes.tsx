import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { dockerVolumePrune, dockerVolumeRemove, dockerVolumes } from "../lib/api";
import { parseDockerVolumes, type DockerVolume } from "../types/docker";
import type { DataTableColumn } from "./DataTable";
import ResourcePage from "./ResourcePage";
import { VolumesIcon, TrashIcon } from "./icons";

export default function Volumes() {
  const { t } = useTranslation();

  const load = useCallback(async () => parseDockerVolumes(await dockerVolumes()), []);

  const columns = useCallback(
    ({
      pendingKey,
      requestRemove,
    }: {
      pendingKey: string | null;
      requestRemove: (row: DockerVolume) => void;
    }): DataTableColumn<DockerVolume>[] => [
      {
        id: "name",
        header: t("volumes.colName"),
        cell: (vol) => (
          <div className="max-w-72 truncate text-anthracite-900" title={vol.Name}>
            {vol.Name}
          </div>
        ),
      },
      {
        id: "driver",
        header: t("volumes.colDriver"),
        className: "whitespace-nowrap",
        cell: (vol) => <span className="text-anthracite-500">{vol.Driver}</span>,
      },
      {
        id: "mountpoint",
        header: t("volumes.colMountpoint"),
        className: "hidden md:table-cell",
        cell: (vol) => (
          <div className="max-w-96 truncate font-mono text-xs text-anthracite-500" title={vol.Mountpoint}>
            {vol.Mountpoint}
          </div>
        ),
      },
      {
        id: "actions",
        header: t("volumes.colActions"),
        align: "right",
        className: "whitespace-nowrap",
        cell: (vol) => (
          <div className="flex items-center justify-end">
            <button
              type="button"
              title={t("volumes.remove")}
              className="icon-btn hover:bg-status-error-soft! hover:text-status-error!"
              disabled={pendingKey === vol.Name}
              onClick={() => requestRemove(vol)}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <ResourcePage<DockerVolume>
      name="volumes"
      title={t("volumes.title")}
      subtitle={t("volumes.subtitle")}
      load={load}
      rowKey={(vol) => vol.Name}
      columns={columns}
      minWidth="min-w-160"
      emptyIcon={<VolumesIcon className="h-9 w-9" />}
      emptyLabel={t("volumes.empty")}
      remove={{
        run: (vol) => dockerVolumeRemove(vol.Name),
        title: t("volumes.removeTitle"),
        description: (vol) => t("volumes.removeDescription", { name: vol.Name }),
        confirmLabel: t("volumes.remove"),
        successToast: (vol) => t("volumes.toastRemoved", { name: vol.Name }),
      }}
      prune={{
        buttonLabel: t("volumes.prune"),
        title: t("volumes.pruneTitle"),
        description: t("volumes.pruneDescription"),
        confirmLabel: t("volumes.prune"),
        run: dockerVolumePrune,
        successToast: t("volumes.toastPruned"),
      }}
    />
  );
}

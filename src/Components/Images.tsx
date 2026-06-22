import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { dockerImagePrune, dockerImageRemove, dockerImages } from "../lib/api";
import { parseDockerImages, type DockerImage } from "../types/docker";
import type { DataTableColumn } from "./DataTable";
import ResourcePage from "./ResourcePage";
import { ImagesIcon, TrashIcon } from "./icons";

function imageName(image: DockerImage): string {
  if (!image.Repository || image.Repository === "<none>") return image.ID;
  const tag = image.Tag && image.Tag !== "<none>" ? `:${image.Tag}` : "";
  return `${image.Repository}${tag}`;
}

export default function Images() {
  const { t } = useTranslation();

  const load = useCallback(async () => parseDockerImages(await dockerImages()), []);

  const columns = useCallback(
    ({
      pendingKey,
      requestRemove,
    }: {
      pendingKey: string | null;
      requestRemove: (row: DockerImage) => void;
    }): DataTableColumn<DockerImage>[] => [
      {
        id: "name",
        header: t("images.colName"),
        cell: (img) => (
          <div className="max-w-72 truncate text-anthracite-900" title={imageName(img)}>
            {imageName(img)}
          </div>
        ),
      },
      {
        id: "id",
        header: t("images.colId"),
        className: "whitespace-nowrap",
        cell: (img) => (
          <span className="font-mono text-xs text-anthracite-500">
            {img.ID.replace(/^sha256:/, "").slice(0, 12)}
          </span>
        ),
      },
      {
        id: "size",
        header: t("images.colSize"),
        className: "whitespace-nowrap hidden sm:table-cell",
        cell: (img) => <span className="text-anthracite-500">{img.Size}</span>,
      },
      {
        id: "created",
        header: t("images.colCreated"),
        className: "whitespace-nowrap hidden md:table-cell",
        cell: (img) => <span className="text-anthracite-500">{img.CreatedSince}</span>,
      },
      {
        id: "actions",
        header: t("images.colActions"),
        align: "right",
        className: "whitespace-nowrap",
        cell: (img) => (
          <div className="flex items-center justify-end">
            <button
              type="button"
              title={t("images.remove")}
              className="icon-btn hover:bg-status-error-soft! hover:text-status-error!"
              disabled={pendingKey === img.ID}
              onClick={() => requestRemove(img)}
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
    <ResourcePage<DockerImage>
      name="images"
      title={t("images.title")}
      subtitle={t("images.subtitle")}
      load={load}
      rowKey={(img) => img.ID}
      columns={columns}
      minWidth="min-w-160"
      emptyIcon={<ImagesIcon className="h-9 w-9" />}
      emptyLabel={t("images.empty")}
      remove={{
        run: (img) => dockerImageRemove(img.ID),
        title: t("images.removeTitle"),
        description: (img) => t("images.removeDescription", { name: imageName(img) }),
        confirmLabel: t("images.remove"),
        successToast: (img) => t("images.toastRemoved", { name: imageName(img) }),
      }}
      prune={{
        buttonLabel: t("images.prune"),
        title: t("images.pruneTitle"),
        description: t("images.pruneDescription"),
        confirmLabel: t("images.prune"),
        run: dockerImagePrune,
        successToast: t("images.toastPruned"),
      }}
    />
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../lib/toast";
import { useResource } from "../lib/dockerData";
import { friendlyDockerError } from "../lib/dockerError";
import DataTable, { type DataTableColumn } from "./DataTable";
import type { ContextMenuItem } from "./ContextMenu";
import ConfirmDialog from "./ConfirmDialog";
import { RefreshIcon, TrashIcon } from "./icons";

export type ResourceColumnsContext<T> = {
  pendingKey: string | null;
  requestRemove: (row: T) => void;
};

type PruneConfig = {
  buttonLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  run: () => Promise<void>;
  successToast: string;
};

type ResourcePageProps<T> = {
  /** Clé de cache (ex. "images", "volumes", "networks"). */
  name: string;
  title: string;
  subtitle: string;
  load: () => Promise<T[]>;
  rowKey: (row: T) => string;
  columns: (ctx: ResourceColumnsContext<T>) => DataTableColumn<T>[];
  emptyIcon: ReactNode;
  emptyLabel: string;
  minWidth?: string;
  remove: {
    run: (row: T) => Promise<void>;
    title: string;
    description: (row: T) => string;
    confirmLabel: string;
    successToast: (row: T) => string;
  };
  prune?: PruneConfig;
};

export default function ResourcePage<T>({
  name,
  title,
  subtitle,
  load,
  rowKey,
  columns,
  emptyIcon,
  emptyLabel,
  minWidth,
  remove,
  prune,
}: ResourcePageProps<T>) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data, loading, error, reload } = useResource<T>(name, load);
  const items = data ?? [];
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const [pendingPrune, setPendingPrune] = useState(false);
  const [pruning, setPruning] = useState(false);

  useEffect(() => {
    if (error) toast.error(friendlyDockerError(error, t));
  }, [error, toast, t]);

  async function handleRefresh() {
    try {
      await reload();
      toast.success(t("resource.toastRefreshed"));
    } catch (err) {
      toast.error(friendlyDockerError(err, t));
    }
  }

  async function confirmRemove() {
    if (pendingDelete === null) return;
    const row = pendingDelete;
    setPendingDelete(null);
    setPendingKey(rowKey(row));
    try {
      await remove.run(row);
      await reload();
      toast.success(remove.successToast(row));
    } catch (err) {
      toast.error(friendlyDockerError(err, t));
    } finally {
      setPendingKey(null);
    }
  }

  async function confirmPrune() {
    if (!prune) return;
    setPendingPrune(false);
    setPruning(true);
    try {
      await prune.run();
      await reload();
      toast.success(prune.successToast);
    } catch (err) {
      toast.error(friendlyDockerError(err, t));
    } finally {
      setPruning(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-3 shrink-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-anthracite-900">{title}</h1>
          <p className="text-sm text-anthracite-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {prune && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPendingPrune(true)}
              disabled={loading || pruning}
            >
              <TrashIcon className="h-4 w-4" />
              {prune.buttonLabel}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("resource.refresh")}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns({ pendingKey, requestRemove: setPendingDelete })}
        rows={items}
        rowKey={rowKey}
        minWidth={minWidth}
        loading={loading}
        rowActions={(row): ContextMenuItem[] => [
          {
            id: "remove",
            label: remove.confirmLabel,
            icon: <TrashIcon className="h-4 w-4" />,
            danger: true,
            disabled: pendingKey === rowKey(row),
            onSelect: () => setPendingDelete(row),
          },
        ]}
        empty={
          <>
            {emptyIcon}
            <p className="text-sm">{emptyLabel}</p>
          </>
        }
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={remove.title}
        description={pendingDelete !== null ? remove.description(pendingDelete) : null}
        confirmLabel={remove.confirmLabel}
        danger
        onConfirm={confirmRemove}
        onCancel={() => setPendingDelete(null)}
      />

      {prune && (
        <ConfirmDialog
          open={pendingPrune}
          title={prune.title}
          description={prune.description}
          confirmLabel={prune.confirmLabel}
          danger
          onConfirm={confirmPrune}
          onCancel={() => setPendingPrune(false)}
        />
      )}
    </div>
  );
}

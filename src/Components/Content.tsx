import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { dockerAction, dockerPs } from "../lib/api";
import { parseDockerPs, type DockerContainer } from "../types/docker";
import StatsCards from "./StatsCards";
import ContainersTable, { type ContainerAction } from "./ContainersTable";
import ConfirmDialog from "./ConfirmDialog";
import LogsDialog from "./LogsDialog";
import { RefreshIcon } from "./icons";
import { useToast } from "../lib/toast";
import { useConnections } from "../lib/connections";

const ACTION_TOAST_KEY: Record<ContainerAction, string> = {
  start: "content.toastStart",
  stop: "content.toastStop",
  restart: "content.toastRestart",
  remove: "content.toastRemove",
};

export default function Content() {
  const { t } = useTranslation();
  const toast = useToast();
  const { activeId } = useConnections();
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<DockerContainer | null>(null);
  const [logsContainer, setLogsContainer] = useState<DockerContainer | null>(null);

  const loadContainers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dockerPs();
      setContainers(parseDockerPs(result));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContainers().catch((err) => toast.error(String(err)));
  }, [loadContainers, activeId]);

  async function handleRefresh() {
    try {
      await loadContainers();
      toast.success(t("content.toastRefreshed"));
    } catch (err) {
      toast.error(String(err));
    }
  }

  async function runAction(container: DockerContainer, action: ContainerAction) {
    setPendingId(container.ID);
    try {
      await dockerAction(action, container.ID);
      await loadContainers();
      toast.success(t(ACTION_TOAST_KEY[action], { name: container.Names }));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setPendingId(null);
    }
  }

  function handleAction(container: DockerContainer, action: ContainerAction) {
    if (action === "remove") {
      setPendingRemoval(container);
      return;
    }
    runAction(container, action);
  }

  function confirmRemoval() {
    if (!pendingRemoval) return;
    const container = pendingRemoval;
    setPendingRemoval(null);
    runAction(container, "remove");
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-3 shrink-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-anthracite-900">{t("content.title")}</h1>
          <p className="text-sm text-anthracite-500 mt-0.5">{t("content.subtitle")}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary w-full sm:w-auto"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("content.refresh")}
        </button>
      </div>

      <div className="shrink-0">
        <StatsCards containers={containers} />
      </div>
      <ContainersTable
        containers={containers}
        pendingId={pendingId}
        onAction={handleAction}
        onShowLogs={setLogsContainer}
      />

      <LogsDialog container={logsContainer} onClose={() => setLogsContainer(null)} />

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={t("content.removeTitle")}
        description={
          pendingRemoval
            ? t("content.removeDescription", { name: pendingRemoval.Names })
            : null
        }
        confirmLabel={t("content.removeConfirm")}
        danger
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}

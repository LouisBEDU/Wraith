import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  closeFirewallRule,
  getFirewallRules,
  isTauri,
  openFirewallPort,
  setSshPort,
} from "../lib/api";
import type { FirewallRule } from "../types/firewall";
import { useToast } from "../lib/toast";
import { useSystemTools } from "../lib/systemTools";
import { useConnections } from "../lib/connections";
import ConfirmDialog from "./ConfirmDialog";
import DataTable, { type DataTableColumn } from "./DataTable";
import {
  AlertTriangleIcon,
  FirewallIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from "./icons";

type Protocol = "tcp" | "udp";

export default function Ports() {
  const { t } = useTranslation();
  const toast = useToast();
  const { tools, refresh: refreshTools } = useSystemTools();
  const { activeId } = useConnections();
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [portInput, setPortInput] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("tcp");
  const [opening, setOpening] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FirewallRule | null>(null);
  const [sshPortInput, setSshPortInput] = useState("");
  const [settingSsh, setSettingSsh] = useState(false);
  const [pendingSshPort, setPendingSshPort] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await refreshTools();
      setRules(fetched?.firewall.available ? await getFirewallRules() : []);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [refreshTools, toast]);

  useEffect(() => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    load();
  }, [load, activeId]);

  const firewall = tools?.firewall ?? null;
  const ssh = tools?.ssh ?? null;
  const canManage = Boolean(firewall?.available && firewall?.manageable);

  const ruleColumns: DataTableColumn<FirewallRule>[] = [
    {
      id: "port",
      header: t("ports.colPort"),
      className: "whitespace-nowrap",
      cell: (rule) => <span className="font-medium text-anthracite-900">{rule.port}</span>,
    },
    {
      id: "protocol",
      header: t("ports.colProtocol"),
      className: "whitespace-nowrap",
      cell: (rule) => <span className="uppercase text-anthracite-500">{rule.protocol}</span>,
    },
    {
      id: "rule",
      header: t("ports.colRule"),
      cell: (rule) => (
        <div className="flex items-center gap-2">
          <span className="max-w-64 truncate text-anthracite-500" title={rule.label}>
            {rule.label}
          </span>
          <span className={`badge shrink-0 ${rule.managed ? "badge-running" : "badge-restarting"}`}>
            {rule.managed ? t("ports.managedBadge") : t("ports.systemBadge")}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: t("ports.colActions"),
      align: "right",
      className: "whitespace-nowrap",
      cell: (rule) => (
        <div className="flex items-center justify-end">
          <button
            type="button"
            title={t("ports.close")}
            className="icon-btn hover:bg-status-error-soft! hover:text-status-error!"
            disabled={!canManage || pendingId === rule.id}
            onClick={() => setPendingDelete(rule)}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  async function handleOpen(e: FormEvent) {
    e.preventDefault();
    const port = Number(portInput);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error(t("ports.toastInvalidPort"));
      return;
    }
    setOpening(true);
    try {
      await openFirewallPort(port, protocol);
      toast.success(t("ports.toastOpened", { port, protocol: protocol.toUpperCase() }));
      setPortInput("");
      setRules(await getFirewallRules());
    } catch (err) {
      toast.error(String(err));
    } finally {
      setOpening(false);
    }
  }

  async function confirmClose() {
    if (!pendingDelete) return;
    const rule = pendingDelete;
    setPendingDelete(null);
    setPendingId(rule.id);
    try {
      await closeFirewallRule(rule);
      toast.success(
        t("ports.toastClosed", { port: rule.port, protocol: rule.protocol.toUpperCase() }),
      );
      setRules(await getFirewallRules());
    } catch (err) {
      toast.error(String(err));
    } finally {
      setPendingId(null);
    }
  }

  function handleSshSubmit() {
    const port = Number(sshPortInput);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error(t("ports.toastInvalidPort"));
      return;
    }
    setPendingSshPort(port);
  }

  async function confirmSshChange() {
    if (pendingSshPort === null) return;
    const port = pendingSshPort;
    setPendingSshPort(null);
    setSettingSsh(true);
    try {
      await setSshPort(port);
      toast.success(t("ports.sshToastChanged", { port }));
      setSshPortInput("");
      await refreshTools();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSettingSsh(false);
    }
  }

  if (!isTauri) {
    return (
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
        <Header t={t} onRefresh={load} loading={loading} disabled />
        <div className="card max-w-lg p-5 text-sm text-anthracite-500">
          {t("ports.webOnlyDesktop")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
      <Header t={t} onRefresh={load} loading={loading} />

      {loading && !tools ? (
        <p className="text-sm text-anthracite-500">{t("ports.loading")}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 shrink-0">
          {ssh && (
            <div className="card p-5 flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-anthracite-900">{t("ports.sshTitle")}</p>
                <p className="text-sm text-anthracite-500 mt-0.5">{t("ports.sshSubtitle")}</p>
              </div>

              {!ssh.installed ? (
                <p className="flex items-start gap-2 text-xs text-anthracite-500">
                  <AlertTriangleIcon className="h-4 w-4 shrink-0 text-status-restarting" />
                  {ssh.message ?? t("ports.sshNotInstalled")}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-anthracite-600">{t("ports.sshCurrentPort")}</span>
                    <span className="badge badge-running">{ssh.port ?? "?"}</span>
                    {ssh.running !== null && (
                      <span className={`badge ${ssh.running ? "badge-running" : "badge-stopped"}`}>
                        {ssh.running ? t("ports.sshRunning") : t("ports.sshStopped")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex flex-1 flex-col gap-1.5">
                      <span className="text-xs font-medium text-anthracite-500">
                        {t("ports.sshNewPort")}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        value={sshPortInput}
                        onChange={(e) => setSshPortInput(e.target.value)}
                        placeholder={String(ssh.port ?? 22)}
                        className="rounded-lg border border-anthracite-100 px-3 py-2 text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary shrink-0"
                      disabled={settingSsh || sshPortInput === ""}
                      onClick={handleSshSubmit}
                    >
                      {settingSsh ? t("ports.sshApplying") : t("ports.sshApply")}
                    </button>
                  </div>
                  <p className="flex items-start gap-2 text-xs text-anthracite-400">
                    <AlertTriangleIcon className="h-4 w-4 shrink-0 text-status-restarting" />
                    {t("ports.sshWarning")}
                  </p>
                </>
              )}
            </div>
          )}

          {canManage && (
            <form onSubmit={handleOpen} className="card p-5 flex flex-col gap-4">
              <span className="text-sm font-medium text-anthracite-900">{t("ports.addTitle")}</span>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-xs font-medium text-anthracite-500">{t("ports.portLabel")}</span>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={portInput}
                    onChange={(e) => setPortInput(e.target.value)}
                    placeholder={t("ports.portPlaceholder")}
                    className="rounded-lg border border-anthracite-100 px-3 py-2 text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-anthracite-500">{t("ports.protocol")}</span>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value as Protocol)}
                    className="rounded-lg border border-anthracite-100 px-3 py-2 text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </select>
                </label>
                <button type="submit" className="btn btn-primary shrink-0" disabled={opening}>
                  <PlusIcon className="h-4 w-4" />
                  {opening ? t("ports.opening") : t("ports.openButton")}
                </button>
              </div>
            </form>
          )}
          </div>

          {firewall?.available && (
            <DataTable
              columns={ruleColumns}
              rows={rules}
              rowKey={(rule) => rule.id}
              minWidth="min-w-120"
              empty={
                <>
                  <FirewallIcon className="h-9 w-9" />
                  <p className="text-sm">{t("ports.tableEmpty")}</p>
                </>
              }
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("ports.removeTitle")}
        description={
          pendingDelete
            ? t("ports.removeDescription", {
                port: pendingDelete.port,
                protocol: pendingDelete.protocol.toUpperCase(),
                rule: pendingDelete.label,
              })
            : null
        }
        confirmLabel={t("ports.removeConfirm")}
        danger
        onConfirm={confirmClose}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingSshPort !== null}
        title={t("ports.sshConfirmTitle")}
        description={
          pendingSshPort !== null
            ? t("ports.sshConfirmDescription", { port: pendingSshPort })
            : null
        }
        confirmLabel={t("ports.sshApply")}
        danger
        onConfirm={confirmSshChange}
        onCancel={() => setPendingSshPort(null)}
      />
    </div>
  );
}

function Header({
  t,
  onRefresh,
  loading,
  disabled = false,
}: {
  t: ReturnType<typeof useTranslation>["t"];
  onRefresh: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 shrink-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-anthracite-900">{t("ports.title")}</h1>
        <p className="text-sm text-anthracite-500 mt-0.5">{t("ports.subtitle")}</p>
      </div>
      {!disabled && (
        <button
          type="button"
          className="btn btn-primary w-full sm:w-auto"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("content.refresh")}
        </button>
      )}
    </div>
  );
}

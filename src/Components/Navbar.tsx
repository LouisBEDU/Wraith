import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRightIcon,
  ContainersIcon,
  DiskIcon,
  DockerIcon,
  FirewallIcon,
  ImagesIcon,
  LogoIcon,
  NetworksIcon,
  ServerIcon,
  SettingsIcon,
  VolumesIcon,
} from "./icons";
import { useUpdate } from "../lib/update";
import { useSystemTools } from "../lib/systemTools";
import { useConnections } from "../lib/connections";
import { getDiskUsage, isTauri, type DiskUsage } from "../lib/api";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const rounded = value >= 100 || i === 0 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded} ${units[i]}`;
}

function DiskUsageWidget() {
  const { t } = useTranslation();
  const { activeId } = useConnections();
  const [usage, setUsage] = useState<DiskUsage | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchUsage = () => {
      getDiskUsage()
        .then((u) => {
          if (!cancelled) setUsage(u);
        })
        .catch(() => {
          if (!cancelled) setUsage(null);
        });
    };
    setUsage(null);
    fetchUsage();
    // Rafraîchissement périodique : l'espace disque évolue (pulls, logs, builds…).
    const id = window.setInterval(fetchUsage, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeId]);

  if (!usage || usage.total <= 0) return null;

  const usedPct = Math.min(100, Math.max(0, (1 - usage.available / usage.total) * 100));
  const freePct = 100 - usedPct;
  const barTone =
    freePct < 10 ? "bg-status-error" : freePct < 20 ? "bg-status-restarting" : "bg-accent-500";
  const iconTone =
    freePct < 10
      ? "text-status-error"
      : freePct < 20
        ? "text-status-restarting"
        : "text-paper/45";
  const tooltip = `${formatBytes(usage.available)} ${t("nav.diskFree")} / ${formatBytes(usage.total)}`;

  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-1.5" title={tooltip}>
      <span className="sidebar-icon">
        <DiskIcon className={`h-5 w-5 shrink-0 ${iconTone}`} />
      </span>
      <span className="sidebar-fade min-w-0 flex-1">
        <span className="flex w-full flex-col gap-1">
          <span className="flex items-center justify-between gap-2 text-[11px] text-paper/55">
            <span className="truncate">{t("nav.disk")}</span>
            <span className="shrink-0 tabular-nums">{formatBytes(usage.available)}</span>
          </span>
          <span className="block h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <span
              className={`block h-full rounded-full transition-all ${barTone}`}
              style={{ width: `${usedPct}%` }}
            />
          </span>
        </span>
      </span>
    </div>
  );
}

export type Page = "containers" | "images" | "volumes" | "networks" | "ports" | "settings";

const dockerItems = [
  { labelKey: "nav.containers", icon: ContainersIcon, page: "containers" as const },
  { labelKey: "nav.images", icon: ImagesIcon, page: "images" as const },
  { labelKey: "nav.volumes", icon: VolumesIcon, page: "volumes" as const },
  { labelKey: "nav.networks", icon: NetworksIcon, page: "networks" as const },
];

type NavbarProps = {
  page: Page;
  onNavigate: (page: Page) => void;
};

export default function Navbar({ page, onNavigate }: NavbarProps) {
  const { t } = useTranslation();
  const update = useUpdate();
  const { tools } = useSystemTools();
  const { connections, activeId } = useConnections();
  const listRef = useRef<HTMLUListElement>(null);
  const [hasScrollbar, setHasScrollbar] = useState(false);
  const [dockerOpen, setDockerOpen] = useState(true);
  const dockerAvailable = !isTauri || tools === null || tools.docker;

  const activeConn = activeId ? (connections.find((c) => c.id === activeId) ?? null) : null;
  const targetName = activeConn ? activeConn.name : t("nav.targetLocal");
  const isRemote = activeId !== null;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const checkOverflow = () => setHasScrollbar(el.scrollHeight > el.clientHeight);

    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="sidebar-rail" data-has-scrollbar={hasScrollbar}>
      <nav className="sidebar-panel">
        <div className="sidebar-header">
          <span className="sidebar-logo">
            <LogoIcon className="h-8 w-8 text-accent-400 shrink-0" />
          </span>
          <span className="sidebar-fade font-semibold tracking-wide">
            {import.meta.env.VITE_APP_NAME}
          </span>
        </div>

        {isTauri && (
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            title={`${t("nav.target")} : ${targetName}`}
            className="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-white/5 px-1 py-1.5 transition-colors hover:bg-white/10"
          >
            <span className="sidebar-icon">
              <ServerIcon
                className={`h-5 w-5 shrink-0 ${isRemote ? "text-accent-400" : "text-paper/45"}`}
              />
            </span>
            <span className="sidebar-fade min-w-0 flex-1">
              <span className="block min-w-0 truncate text-xs font-medium text-paper/80">
                {targetName}
              </span>
            </span>
          </button>
        )}

        <ul ref={listRef} className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          <li>
            <button
              type="button"
              title={dockerAvailable ? "Docker" : t("nav.dockerUnavailable")}
              disabled={!dockerAvailable}
              aria-expanded={dockerOpen}
              onClick={() => setDockerOpen((open) => !open)}
              className={`sidebar-link ${
                dockerAvailable ? "text-paper/55 cursor-pointer" : "text-paper/30"
              }`}
            >
              <span className="sidebar-icon">
                <DockerIcon className="h-5 w-5 shrink-0" />
              </span>
              <span className="sidebar-fade flex-1 items-center justify-between gap-2">
                <span>Docker</span>
                {dockerAvailable && (
                  <ChevronRightIcon
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      dockerOpen ? "rotate-90" : ""
                    }`}
                  />
                )}
              </span>
            </button>

            {dockerAvailable && dockerOpen && (
              <ul className="sidebar-subgroup">
                {dockerItems.map(({ labelKey, icon: Icon, page: itemPage }, index) => {
                  const active = itemPage !== null && itemPage === page;
                  const label = t(labelKey);
                  return (
                    <li key={`${labelKey}-${index}`}>
                      <button
                        type="button"
                        title={label}
                        disabled={itemPage === null}
                        onClick={itemPage ? () => onNavigate(itemPage) : undefined}
                        className={`sidebar-link ${
                          active ? "bg-accent-600 text-paper" : "text-paper/55 cursor-pointer"
                        }`}
                      >
                        <span className="sidebar-icon">
                          <Icon className="h-4 w-4 shrink-0" />
                        </span>
                        <span className="sidebar-fade flex-1 items-center justify-between gap-2">
                          <span>{label}</span>
                          {itemPage === null && (
                            <span className="text-[10px] uppercase tracking-wide text-paper/35 bg-white/5 rounded-full px-2 py-0.5 shrink-0">
                              {t("nav.soon")}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>

          <li>
            <button
              type="button"
              title={t("nav.ports")}
              onClick={() => onNavigate("ports")}
              className={`sidebar-link ${
                page === "ports" ? "bg-accent-600 text-paper" : "text-paper/55 cursor-pointer"
              }`}
            >
              <span className="sidebar-icon">
                <FirewallIcon className="h-5 w-5 shrink-0" />
              </span>
              <span className="sidebar-fade flex-1 items-center justify-between gap-2">
                <span>{t("nav.ports")}</span>
              </span>
            </button>
          </li>
        </ul>

        <div className="px-3 py-4 border-t border-white/10">
          <DiskUsageWidget />
          <button
            type="button"
            title={
              update.available
                ? `${t("nav.settings")} — ${t("settings.updateAvailable", { version: update.version })}`
                : t("nav.settings")
            }
            onClick={() => onNavigate("settings")}
            className={`sidebar-link ${
              page === "settings" ? "bg-accent-600 text-paper" : "text-paper/55 cursor-pointer"
            }`}
          >
            <span className="sidebar-icon relative">
              <SettingsIcon className="h-5 w-5 shrink-0" />
              {update.available && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-500 ring-2 ring-anthracite-900" />
                </span>
              )}
            </span>
            <span className="sidebar-fade flex-1 items-center justify-between gap-2">
              <span>{t("nav.settings")}</span>
              {update.available && (
                <span className="h-1.5 w-1.5 rounded-full bg-accent-400 shrink-0" />
              )}
            </span>
          </button>
          <p className="sidebar-fade px-3 pt-2 text-[11px] text-paper/35">
            v{import.meta.env.VITE_APP_VERSION}
          </p>
        </div>
      </nav>
    </div>
  );
}

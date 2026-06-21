import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRightIcon,
  ContainersIcon,
  DockerIcon,
  FirewallIcon,
  ImagesIcon,
  LogoIcon,
  LogsIcon,
  NetworksIcon,
  ServerIcon,
  SettingsIcon,
  VolumesIcon,
} from "./icons";
import { useUpdate } from "../lib/update";
import { useSystemTools } from "../lib/systemTools";
import { useConnections } from "../lib/connections";
import { isTauri } from "../lib/api";

export type Page = "containers" | "ports" | "settings";

const dockerItems = [
  { labelKey: "nav.containers", icon: ContainersIcon, page: "containers" as const },
  { labelKey: "nav.images", icon: ImagesIcon, page: null },
  { labelKey: "nav.volumes", icon: VolumesIcon, page: null },
  { labelKey: "nav.networks", icon: NetworksIcon, page: null },
  { labelKey: "nav.logs", icon: LogsIcon, page: null },
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

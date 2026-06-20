import { useEffect, useRef, useState } from "react";
import { isTauri } from "../lib/api";
import {
  ContainersIcon,
  ImagesIcon,
  LogoIcon,
  LogsIcon,
  NetworksIcon,
  SettingsIcon,
  VolumesIcon,
} from "./icons";

export type Page = "containers" | "settings";

const navItems = [
  { label: "Conteneurs", icon: ContainersIcon, page: "containers" as const },
  { label: "Images", icon: ImagesIcon, page: null },
  { label: "Volumes", icon: VolumesIcon, page: null },
  { label: "Réseaux", icon: NetworksIcon, page: null },
  { label: "Logs", icon: LogsIcon, page: null },
];

type NavbarProps = {
  page: Page;
  onNavigate: (page: Page) => void;
};

export default function Navbar({ page, onNavigate }: NavbarProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [hasScrollbar, setHasScrollbar] = useState(false);

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

        <ul ref={listRef} className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map(({ label, icon: Icon, page: itemPage }, index) => {
            const active = itemPage !== null && itemPage === page;
            return (
              <li key={`${label}-${index}`}>
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
                    <Icon className="h-5 w-5 shrink-0" />
                  </span>
                  <span className="sidebar-fade flex-1 items-center justify-between gap-2">
                    <span>{label}</span>
                    {itemPage === null && (
                      <span className="text-[10px] uppercase tracking-wide text-paper/35 bg-white/5 rounded-full px-2 py-0.5 shrink-0">
                        Bientôt
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="px-3 py-4 border-t border-white/10">
          {isTauri && (
            <button
              type="button"
              title="Paramètres"
              onClick={() => onNavigate("settings")}
              className={`sidebar-link ${
                page === "settings" ? "bg-accent-600 text-paper" : "text-paper/55 cursor-pointer"
              }`}
            >
              <span className="sidebar-icon">
                <SettingsIcon className="h-5 w-5 shrink-0" />
              </span>
              <span className="sidebar-fade">Paramètres</span>
            </button>
          )}
          <p className="sidebar-fade px-3 pt-2 text-[11px] text-paper/35">
            v{import.meta.env.VITE_APP_VERSION}
          </p>
        </div>
      </nav>
    </div>
  );
}

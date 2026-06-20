import {
  ContainersIcon,
  ImagesIcon,
  LogoIcon,
  LogsIcon,
  NetworksIcon,
  SettingsIcon,
  VolumesIcon,
} from "./icons";

const navItems = [
  { label: "Conteneurs", icon: ContainersIcon, active: true },
  { label: "Images", icon: ImagesIcon, active: false },
  { label: "Volumes", icon: VolumesIcon, active: false },
  { label: "Réseaux", icon: NetworksIcon, active: false },
  { label: "Logs", icon: LogsIcon, active: false },
];

export default function Navbar() {
  return (
    <div className="sidebar-rail">
      <nav className="sidebar-panel">
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 text-paper">
          <LogoIcon className="h-6 w-6 text-accent-400 shrink-0" />
          <span className="sidebar-fade font-semibold tracking-wide">
            {import.meta.env.VITE_APP_NAME}
          </span>
        </div>

        <ul className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map(({ label, icon: Icon, active }) => (
            <li key={label}>
              <button
                type="button"
                title={label}
                disabled={!active}
                className={`sidebar-link ${
                  active ? "bg-accent-600 text-paper" : "text-paper/55 cursor-default"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="sidebar-fade flex-1 items-center justify-between gap-2">
                  <span>{label}</span>
                  {!active && (
                    <span className="text-[10px] uppercase tracking-wide text-paper/35 bg-white/5 rounded-full px-2 py-0.5 shrink-0">
                      Bientôt
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="px-3 py-4 border-t border-white/10">
          <button type="button" title="Paramètres" disabled className="sidebar-link text-paper/55 cursor-default">
            <SettingsIcon className="h-5 w-5 shrink-0" />
            <span className="sidebar-fade">Paramètres</span>
          </button>
          <p className="sidebar-fade px-3 pt-2 text-[11px] text-paper/35">v0.1.0</p>
        </div>
      </nav>
    </div>
  );
}

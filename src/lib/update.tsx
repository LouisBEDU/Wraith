import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateContextValue = {
  available: boolean;
  version: string | null;
  installing: boolean;
  install: () => Promise<void>;
};

const UpdateContext = createContext<UpdateContextValue | null>(null);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    check()
      .then((result) => setUpdate(result))
      .catch(() => setUpdate(null));
  }, []);

  const install = useCallback(async () => {
    if (!update) return;
    setInstalling(true);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } finally {
      setInstalling(false);
    }
  }, [update]);

  const value: UpdateContextValue = {
    available: update !== null,
    version: update?.version ?? null,
    installing,
    install,
  };

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (!ctx) {
    throw new Error("useUpdate() doit être utilisé à l'intérieur d'un <UpdateProvider>");
  }
  return ctx;
}

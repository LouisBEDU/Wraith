import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSystemTools, isTauri } from "./api";
import type { SystemTools } from "../types/firewall";

type SystemToolsContextValue = {
  tools: SystemTools | null;
  loading: boolean;
  refresh: () => Promise<SystemTools | null>;
};

const SystemToolsContext = createContext<SystemToolsContextValue | null>(null);

export function SystemToolsProvider({ children }: { children: ReactNode }) {
  const [tools, setTools] = useState<SystemTools | null>(null);
  const [loading, setLoading] = useState(isTauri);

  const refresh = useCallback(async (): Promise<SystemTools | null> => {
    if (!isTauri) {
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const fetched = await getSystemTools();
      setTools(fetched);
      return fetched;
    } catch {
      setTools(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SystemToolsContext.Provider value={{ tools, loading, refresh }}>
      {children}
    </SystemToolsContext.Provider>
  );
}

export function useSystemTools(): SystemToolsContextValue {
  const ctx = useContext(SystemToolsContext);
  if (!ctx) {
    throw new Error("useSystemTools() doit être utilisé à l'intérieur d'un <SystemToolsProvider>");
  }
  return ctx;
}

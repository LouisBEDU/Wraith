import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getActiveConnection,
  isTauri,
  listConnections,
  setActiveConnection as apiSetActive,
} from "./api";
import type { ConnectionProfile } from "../types/connection";

type ConnectionsContextValue = {
  connections: ConnectionProfile[];
  activeId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setActive: (id: string | null) => Promise<void>;
};

const ConnectionsContext = createContext<ConnectionsContextValue | null>(null);

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<ConnectionProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isTauri);

  const refresh = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [list, active] = await Promise.all([listConnections(), getActiveConnection()]);
      setConnections(list);
      setActiveId(active);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActive = useCallback(async (id: string | null) => {
    await apiSetActive(id);
    setActiveId(id);
  }, []);

  return (
    <ConnectionsContext.Provider value={{ connections, activeId, loading, refresh, setActive }}>
      {children}
    </ConnectionsContext.Provider>
  );
}

export function useConnections(): ConnectionsContextValue {
  const ctx = useContext(ConnectionsContext);
  if (!ctx) {
    throw new Error("useConnections() doit être utilisé à l'intérieur d'un <ConnectionsProvider>");
  }
  return ctx;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConnections } from "./connections";

type Status = "loading" | "success" | "error";

type Entry = {
  data: unknown[] | null;
  status: Status;
  error: unknown;
  loadedForId: string | null;
};

type EntryUpdater = (prev: Entry | undefined) => Entry;

type DockerDataContextValue = {
  entries: Record<string, Entry>;
  setEntry: (name: string, updater: EntryUpdater) => void;
};

const DockerDataContext = createContext<DockerDataContextValue | null>(null);

export function DockerDataProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  const setEntry = useCallback((name: string, updater: EntryUpdater) => {
    setEntries((all) => ({ ...all, [name]: updater(all[name]) }));
  }, []);

  return (
    <DockerDataContext.Provider value={{ entries, setEntry }}>
      {children}
    </DockerDataContext.Provider>
  );
}

function useDockerData(): DockerDataContextValue {
  const ctx = useContext(DockerDataContext);
  if (!ctx) {
    throw new Error("useResource() doit être utilisé à l'intérieur d'un <DockerDataProvider>");
  }
  return ctx;
}

export type Resource<T> = {
  data: T[] | null;
  loading: boolean;
  error: unknown;
  reload: () => Promise<void>;
};

export function useResource<T>(name: string, loader: () => Promise<T[]>): Resource<T> {
  const { entries, setEntry } = useDockerData();
  const { activeId } = useConnections();

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const reload = useCallback(async () => {
    setEntry(name, (prev) => ({
      data: prev?.loadedForId === activeId ? prev.data : null,
      status: "loading",
      error: null,
      loadedForId: activeId,
    }));
    try {
      const data = await loader();
      setEntry(name, () => ({ data, status: "success", error: null, loadedForId: activeId }));
    } catch (error) {
      setEntry(name, (prev) => ({
        data: prev?.data ?? null,
        status: "error",
        error,
        loadedForId: activeId,
      }));
    }
  }, [name, loader, activeId, setEntry]);

  useEffect(() => {
    const current = entriesRef.current[name];
    if (current && current.status === "success" && current.loadedForId === activeId) {
      return;
    }
    reload();
  }, [name, activeId, reload]);

  const entry = entries[name];
  return {
    data: (entry?.data as T[] | null) ?? null,
    loading: entry === undefined || entry.status === "loading",
    error: entry?.status === "error" ? entry.error : null,
    reload,
  };
}

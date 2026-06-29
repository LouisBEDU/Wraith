import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { listen } from "@tauri-apps/api/event";
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
  registerReload: (name: string, reload: () => void) => () => void;
  consumeStale: (name: string) => boolean;
};

type DockerEvent = { type: string; action: string };

const RESOURCE_FOR_TYPE: Record<string, string[]> = {
  container: ["containers"],
  image: ["images"],
  volume: ["volumes"],
  network: ["networks"],
};

const RELOAD_DEBOUNCE_MS = 300;

const DockerDataContext = createContext<DockerDataContextValue | null>(null);

export function DockerDataProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  const setEntry = useCallback((name: string, updater: EntryUpdater) => {
    setEntries((all) => ({ ...all, [name]: updater(all[name]) }));
  }, []);

  const reloaders = useRef<Map<string, Set<() => void>>>(new Map());
  const timers = useRef<Map<string, number>>(new Map());
  const stale = useRef<Set<string>>(new Set());

  const registerReload = useCallback((name: string, reload: () => void) => {
    let set = reloaders.current.get(name);
    if (!set) {
      set = new Set();
      reloaders.current.set(name, set);
    }
    set.add(reload);
    return () => {
      set.delete(reload);
      if (set.size === 0) reloaders.current.delete(name);
    };
  }, []);

  const triggerReload = useCallback((name: string) => {
    const pending = timers.current.get(name);
    if (pending !== undefined) window.clearTimeout(pending);
    const id = window.setTimeout(() => {
      timers.current.delete(name);
      const listeners = reloaders.current.get(name);
      if (listeners && listeners.size > 0) {
        stale.current.delete(name);
        listeners.forEach((reload) => reload());
      } else {
        stale.current.add(name);
      }
    }, RELOAD_DEBOUNCE_MS);
    timers.current.set(name, id);
  }, []);

  const consumeStale = useCallback((name: string) => {
    const wasStale = stale.current.has(name);
    stale.current.delete(name);
    return wasStale;
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    listen<DockerEvent>("docker:event", (event) => {
      const names = RESOURCE_FOR_TYPE[event.payload.type];
      names?.forEach(triggerReload);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [triggerReload]);

  return (
    <DockerDataContext.Provider value={{ entries, setEntry, registerReload, consumeStale }}>
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
  const { entries, setEntry, registerReload, consumeStale } = useDockerData();
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
    const fresh =
      current && current.status === "success" && current.loadedForId === activeId;
    if (fresh && !consumeStale(name)) {
      return;
    }
    reload();
  }, [name, activeId, reload, consumeStale]);

  useEffect(() => registerReload(name, reload), [name, reload, registerReload]);

  const entry = entries[name];
  return {
    data: (entry?.data as T[] | null) ?? null,
    loading: entry === undefined || entry.status === "loading",
    error: entry?.status === "error" ? entry.error : null,
    reload,
  };
}

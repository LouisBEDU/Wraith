import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { dockerExecCommand } from "../lib/api";
import { friendlyDockerError } from "../lib/dockerError";
import type { DockerContainer } from "../types/docker";
import Select from "./Select";
import Tooltip from "./Tooltip";
import { CloseIcon, TerminalIcon, TrashIcon } from "./icons";

type ConsoleDialogProps = {
  container: DockerContainer | null;
  onClose: () => void;
};

type Entry = {
  id: number;
  shell: string;
  command: string;
  stdout: string;
  stderr: string;
  code: number;
};

const SHELLS = ["sh", "bash"] as const;

export default function ConsoleDialog({ container, onClose }: ConsoleDialogProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [shell, setShell] = useState<string>("sh");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  // Réinitialise la console à chaque conteneur ouvert.
  useEffect(() => {
    setEntries([]);
    setInput("");
    setHistory([]);
    setHistoryIndex(null);
    nextId.current = 0;
    if (container) {
      // Laisse le temps au dialogue de se monter avant de focus.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [container?.ID]);

  // Auto-scroll en bas à chaque nouvelle sortie.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, running]);

  async function run() {
    const command = input.trim();
    if (!command || running || !container) return;

    setHistory((h) => [...h, command]);
    setHistoryIndex(null);
    setInput("");
    setRunning(true);
    try {
      const out = await dockerExecCommand(container.ID, shell, command);
      pushEntry({ command, stdout: out.stdout, stderr: out.stderr, code: out.code });
    } catch (err) {
      pushEntry({ command, stdout: "", stderr: friendlyDockerError(err, t), code: -1 });
    } finally {
      setRunning(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function pushEntry(e: Omit<Entry, "id" | "shell">) {
    setEntries((prev) => [...prev, { id: nextId.current++, shell, ...e }]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      run();
      return;
    }
    if (e.key === "ArrowUp") {
      if (history.length === 0) return;
      e.preventDefault();
      const idx = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(idx);
      setInput(history[idx]);
      return;
    }
    if (e.key === "ArrowDown") {
      if (historyIndex === null) return;
      e.preventDefault();
      const idx = historyIndex + 1;
      if (idx >= history.length) {
        setHistoryIndex(null);
        setInput("");
      } else {
        setHistoryIndex(idx);
        setInput(history[idx]);
      }
    }
  }

  if (!container) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card flex h-[70vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-anthracite-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 truncate text-sm font-semibold text-anthracite-900">
              <TerminalIcon className="h-4 w-4 shrink-0 text-anthracite-400" />
              {t("consoleDialog.title", { name: container.Names })}
            </h2>
            <p className="mt-0.5 truncate text-xs text-anthracite-400">
              {t("consoleDialog.subtitle")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip label={t("consoleDialog.clear")}>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEntries([])}
                disabled={entries.length === 0}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </Tooltip>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label={t("common.cancel")}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto bg-anthracite-950 px-4 py-3 font-mono text-xs leading-relaxed"
          onClick={() => inputRef.current?.focus()}
        >
          {entries.length === 0 && !running ? (
            <p className="text-paper/40">{t("consoleDialog.empty")}</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="mb-2">
                <div className="flex gap-2 whitespace-pre-wrap break-all">
                  <span className="shrink-0 select-none text-status-running">$</span>
                  <span className="text-paper/90">{e.command}</span>
                </div>
                {e.stdout && (
                  <div className="whitespace-pre-wrap break-all text-paper/80">{e.stdout}</div>
                )}
                {e.stderr && (
                  <div className="whitespace-pre-wrap break-all text-status-error">{e.stderr}</div>
                )}
                {e.code !== 0 && (
                  <div className="select-none text-[11px] text-paper/30">
                    {t("consoleDialog.exit", { code: e.code })}
                  </div>
                )}
              </div>
            ))
          )}
          {running && (
            <div className="flex items-center gap-2 text-paper/40">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-paper/20 border-t-paper/60" />
              {t("consoleDialog.running")}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-anthracite-100 px-3 py-2.5">
          <Select
            value={shell}
            onChange={setShell}
            wrapperClassName="shrink-0"
            className="font-mono text-xs"
            ariaLabel="Shell"
            options={SHELLS.map((s) => ({ value: s, label: s }))}
          />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("consoleDialog.placeholder")}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            className="min-w-0 flex-1 rounded-lg border border-anthracite-100 px-3 py-2 font-mono text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <button
            type="button"
            className="btn btn-primary shrink-0"
            onClick={run}
            disabled={running || input.trim() === ""}
          >
            {running ? t("consoleDialog.running") : t("consoleDialog.run")}
          </button>
        </div>
      </div>
    </div>
  );
}

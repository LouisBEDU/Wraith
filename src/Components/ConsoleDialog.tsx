import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { consoleClose, consoleExec, consoleOpen, containerAttachable } from "../lib/api";
import { friendlyDockerError } from "../lib/dockerError";
import type { DockerContainer } from "../types/docker";
import Select from "./Select";
import ServerConsole from "./ServerConsole";
import Tooltip from "./Tooltip";
import { CloseIcon, TerminalIcon, TrashIcon } from "./icons";

type ConsoleDialogProps = {
  container: DockerContainer | null;
  onClose: () => void;
};

type Mode = "server" | "shell";

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
  const [mode, setMode] = useState<Mode>("server");
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [shell, setShell] = useState<string>("sh");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const sessionRef = useRef<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    setMode("server");
    setServerAvailable(null);
    setEntries([]);
    setInput("");
    setHistory([]);
    setHistoryIndex(null);
    nextId.current = 0;
    if (container) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [container?.ID]);

  useEffect(() => {
    if (!container) return;
    let active = true;
    containerAttachable(container.ID)
      .then((ok) => {
        if (!active) return;
        setServerAvailable(ok);
        if (!ok) setMode("shell");
      })
      .catch(() => {
        if (!active) return;
        setServerAvailable(false);
        setMode("shell");
      });
    return () => {
      active = false;
    };
  }, [container?.ID]);

  useEffect(() => {
    if (!container || mode !== "shell") return;
    let active = true;
    sessionRef.current = null;
    setSessionError(null);
    setOpening(true);
    consoleOpen(container.ID, shell)
      .then((id) => {
        if (!active) {
          consoleClose(id);
          return;
        }
        sessionRef.current = id;
      })
      .catch((err) => {
        if (active) setSessionError(friendlyDockerError(err, t));
      })
      .finally(() => {
        if (active) setOpening(false);
      });
    return () => {
      active = false;
      if (sessionRef.current) {
        consoleClose(sessionRef.current);
        sessionRef.current = null;
      }
    };
  }, [container?.ID, shell, mode]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, running]);

  async function reopenSession() {
    const old = sessionRef.current;
    sessionRef.current = null;
    if (old) await consoleClose(old).catch(() => {});
    if (!container) return;
    try {
      sessionRef.current = await consoleOpen(container.ID, shell);
      setSessionError(null);
    } catch {
      sessionRef.current = null;
    }
  }

  async function run() {
    const command = input.trim();
    if (!command || running || opening || !container) return;

    let sid = sessionRef.current;
    if (!sid) {
      try {
        sid = await consoleOpen(container.ID, shell);
        sessionRef.current = sid;
        setSessionError(null);
      } catch (err) {
        pushEntry({ command, stdout: "", stderr: friendlyDockerError(err, t), code: -1 });
        return;
      }
    }

    setHistory((h) => [...h, command]);
    setHistoryIndex(null);
    setInput("");
    setRunning(true);
    try {
      const out = await consoleExec(sid, command);
      pushEntry({ command, stdout: out.stdout, stderr: out.stderr, code: out.code });
    } catch (err) {
      pushEntry({ command, stdout: "", stderr: friendlyDockerError(err, t), code: -1 });
      await reopenSession();
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
            <div className="mt-1.5 flex gap-1">
              {(["server", "shell"] as const).map((m) => {
                const serverDisabled = m === "server" && serverAvailable === false;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    disabled={serverDisabled}
                    title={serverDisabled ? t("serverConsole.unavailable") : undefined}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      mode === m
                        ? "bg-anthracite-900 text-paper"
                        : "text-anthracite-500 hover:bg-anthracite-100"
                    }`}
                  >
                    {t(m === "server" ? "consoleDialog.tabServer" : "consoleDialog.tabShell")}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {mode === "shell" && (
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
            )}
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

        {mode === "server" ? (
          serverAvailable === true ? (
            <ServerConsole container={container} />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center bg-anthracite-950 px-6 text-center font-mono text-xs text-paper/40">
              {serverAvailable === null
                ? t("serverConsole.checking")
                : t("serverConsole.unavailable")}
            </div>
          )
        ) : (
        <>
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto bg-anthracite-950 px-4 py-3 font-mono text-xs leading-relaxed"
          onClick={() => inputRef.current?.focus()}
        >
          {entries.length === 0 && !running && !sessionError ? (
            <p className="text-paper/40">
              {opening ? t("consoleDialog.connecting") : t("consoleDialog.empty")}
            </p>
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
          {sessionError && (
            <p className="mt-1 whitespace-pre-wrap break-all text-status-error">{sessionError}</p>
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
            disabled={opening}
            className="min-w-0 flex-1 rounded-lg border border-anthracite-100 px-3 py-2 font-mono text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-60"
          />
          <button
            type="button"
            className="btn btn-primary shrink-0"
            onClick={run}
            disabled={running || opening || input.trim() === ""}
          >
            {running ? t("consoleDialog.running") : t("consoleDialog.run")}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

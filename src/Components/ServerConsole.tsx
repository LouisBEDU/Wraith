import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { attachClose, attachOpen, attachWrite, type AttachOutput } from "../lib/api";
import { friendlyDockerError } from "../lib/dockerError";
import type { DockerContainer } from "../types/docker";
import Ansi from "../lib/ansi";

type Status = "connecting" | "open" | "closed" | "error";

const MAX_CHARS = 200_000;

function clampBuffer(text: string): string {
  return text.length > MAX_CHARS ? text.slice(text.length - MAX_CHARS) : text;
}

const ESC = String.fromCharCode(27);
const CSI_NON_SGR = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-ln-~]`, "g");
const OSC = new RegExp(`${ESC}[\\]P^_X][^\\u0007]*?(?:\\u0007|${ESC}\\\\)`, "g");
const ESC_SINGLE = new RegExp(`${ESC}[@-Z\\\\-_]`, "g");

function sanitize(text: string): string {
  return text
    .replace(CSI_NON_SGR, "")
    .replace(OSC, "")
    .replace(ESC_SINGLE, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "");
}

export default function ServerConsole({ container }: { container: DockerContainer }) {
  const { t } = useTranslation();
  const [output, setOutput] = useState("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const sessionRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    let unlistenOutput: (() => void) | undefined;
    let unlistenClosed: (() => void) | undefined;

    sessionRef.current = null;
    setOutput("");
    setInput("");
    setStatus("connecting");
    setErrorMsg(null);

    Promise.all([
      listen<AttachOutput>("attach:output", (event) => {
        if (event.payload.id !== sessionRef.current) return;
        setOutput((prev) => clampBuffer(prev + sanitize(event.payload.data)));
      }),
      listen<string>("attach:closed", (event) => {
        if (event.payload !== sessionRef.current) return;
        setStatus("closed");
      }),
    ]).then(([off1, off2]) => {
      if (!active) {
        off1();
        off2();
        return;
      }
      unlistenOutput = off1;
      unlistenClosed = off2;
    });

    attachOpen(container.ID)
      .then((id) => {
        if (!active) {
          attachClose(id);
          return;
        }
        sessionRef.current = id;
        setStatus("open");
        requestAnimationFrame(() => inputRef.current?.focus());
      })
      .catch((err) => {
        if (active) {
          setStatus("error");
          setErrorMsg(friendlyDockerError(err, t));
        }
      });

    return () => {
      active = false;
      unlistenOutput?.();
      unlistenClosed?.();
      if (sessionRef.current) {
        attachClose(sessionRef.current);
        sessionRef.current = null;
      }
    };
  }, [container.ID]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [output]);

  async function send() {
    const command = input.trim();
    if (!command || status !== "open" || !sessionRef.current) return;
    setHistory((h) => [...h, command]);
    setHistoryIndex(null);
    setInput("");
    setOutput((prev) => clampBuffer(`${prev}> ${command}\n`));
    try {
      await attachWrite(sessionRef.current, `${command}\n`);
    } catch (err) {
      setOutput((prev) => clampBuffer(`${prev}${friendlyDockerError(err, t)}\n`));
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
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

  const disabled = status !== "open";

  return (
    <>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 select-text overflow-auto bg-anthracite-950 px-4 py-3 font-mono text-xs leading-relaxed"
        onClick={() => inputRef.current?.focus()}
      >
        {status === "error" ? (
          <p className="whitespace-pre-wrap break-all text-status-error">
            {errorMsg ?? t("serverConsole.error")}
          </p>
        ) : output === "" && status === "connecting" ? (
          <p className="text-paper/40">{t("serverConsole.connecting")}</p>
        ) : (
          <pre className="whitespace-pre-wrap break-all text-paper/85">
            <Ansi text={output} />
          </pre>
        )}
        {status === "closed" && (
          <p className="mt-1 select-none text-[11px] text-paper/40">{t("serverConsole.closed")}</p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-anthracite-100 px-3 py-2.5">
        <span className="shrink-0 select-none font-mono text-sm text-status-running">›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("serverConsole.placeholder")}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          disabled={disabled}
          className="min-w-0 flex-1 rounded-lg border border-anthracite-100 px-3 py-2 font-mono text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-60"
        />
        <button
          type="button"
          className="btn btn-primary shrink-0"
          onClick={send}
          disabled={disabled || input.trim() === ""}
        >
          {t("serverConsole.send")}
        </button>
      </div>
    </>
  );
}

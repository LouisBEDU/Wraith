import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { dockerLogs } from "../lib/api";
import { friendlyDockerError } from "../lib/dockerError";
import type { DockerContainer } from "../types/docker";
import Tooltip from "./Tooltip";
import Ansi, { stripAnsi } from "../lib/ansi";
import { CheckCircleIcon, CloseIcon, CopyIcon, RefreshIcon, TerminalIcon } from "./icons";

type LogsDialogProps = {
  container: DockerContainer | null;
  onClose: () => void;
};

const POLL_MS = 2000;
const BOTTOM_THRESHOLD_PX = 48;
const TIMESTAMP_LINE = /^(\S+)\s(.*)$/;
const ERROR_PATTERN = /\b(error|err|fatal|panic|exception)\b/i;
const WARN_PATTERN = /\b(warn|warning)\b/i;

type LineTone = "error" | "warn" | "default";

type ParsedLine = {
  key: number;
  time: string | null;
  text: string;
  tone: LineTone;
};

const TONE_CLASS: Record<LineTone, string> = {
  error: "text-status-error",
  warn: "text-status-restarting",
  default: "text-paper/80",
};

function formatTimestamp(raw: string): string | null {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(undefined, { hour12: false });
}

function classifyTone(text: string): LineTone {
  if (ERROR_PATTERN.test(text)) return "error";
  if (WARN_PATTERN.test(text)) return "warn";
  return "default";
}

function parseLines(raw: string): ParsedLine[] {
  return raw
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const match = line.match(TIMESTAMP_LINE);
      const time = match ? formatTimestamp(match[1]) : null;
      const text = match && time !== null ? match[2] : line;
      return { key: index, time, text, tone: classifyTone(stripAnsi(text)) };
    });
}

export default function LogsDialog({ container, onClose }: LogsDialogProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didOpenScrollRef = useRef(false);
  const atBottomRef = useRef(true);

  const load = useCallback(async (id: string, silent: boolean) => {
    if (!silent) setLoading(true);
    try {
      const raw = await dockerLogs(id);
      setLogs(raw);
      if (!silent) setError(null);
    } catch (err) {
      if (!silent) setError(friendlyDockerError(err, t));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    atBottomRef.current = atBottom;
  }, [atBottom]);

  useEffect(() => {
    if (!container) return;
    didOpenScrollRef.current = false;
    load(container.ID, false);
    const interval = window.setInterval(() => load(container.ID, true), POLL_MS);
    return () => window.clearInterval(interval);
  }, [container?.ID, load]);

  // Sur mobile, la hauteur réelle du viewport bouge après le premier rendu
  // (barre d'adresse qui se réduit, clavier, etc.), donc scrollHeight n'est
  // pas toujours fiable tout de suite : on observe la taille du conteneur
  // et on recolle en bas chaque fois qu'elle change, tant qu'on est censé
  // suivre les derniers logs.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (!didOpenScrollRef.current) {
      didOpenScrollRef.current = true;
      setAtBottom(true);
      // Double rAF : on attend que le navigateur ait fini la mise en page
      // (surtout sur mobile, où la hauteur du viewport peut encore bouger)
      // avant de mesurer scrollHeight et de scroller en bas.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      });
      return;
    }

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < BOTTOM_THRESHOLD_PX) {
      el.scrollTop = el.scrollHeight;
      setAtBottom(true);
    } else {
      setAtBottom(false);
    }
  }, [logs]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX);
  }

  function jumpToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(stripAnsi(logs));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papier indisponible (permissions, contexte non sécurisé) : on ignore silencieusement.
    }
  }

  if (!container) return null;

  const lines = parseLines(logs);

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
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 truncate text-sm font-semibold text-anthracite-900">
                <TerminalIcon className="h-4 w-4 shrink-0 text-anthracite-400" />
                {t("logsDialog.title", { name: container.Names })}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-anthracite-400">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-running opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-running" />
                </span>
                {t("logsDialog.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip label={t("logsDialog.copy")}>
              <button type="button" className="icon-btn" onClick={handleCopy}>
                {copied ? (
                  <CheckCircleIcon className="h-4 w-4 text-status-running" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
              </button>
            </Tooltip>
            <Tooltip label={t("content.refresh")}>
              <button
                type="button"
                className="icon-btn"
                onClick={() => load(container.ID, false)}
                disabled={loading}
              >
                <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full select-text overflow-auto bg-anthracite-950 px-4 py-3 font-mono text-xs leading-relaxed"
          >
            {error ? (
              <p className="text-status-error">{error}</p>
            ) : lines.length === 0 ? (
              <p className="text-paper/40">
                {loading ? t("logsDialog.loading") : t("logsDialog.empty")}
              </p>
            ) : (
              lines.map((line) => (
                <div key={line.key} className="flex gap-3 whitespace-pre-wrap break-all">
                  {line.time && (
                    <span className="shrink-0 select-none text-paper/30">{line.time}</span>
                  )}
                  <span className={TONE_CLASS[line.tone]}>
                    <Ansi text={line.text} />
                  </span>
                </div>
              ))
            )}
          </div>

          {!atBottom && lines.length > 0 && (
            <button
              type="button"
              onClick={jumpToBottom}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-accent-600 px-3 py-1.5 text-xs font-medium text-paper shadow-lg transition-colors hover:bg-accent-700"
            >
              {t("logsDialog.jumpToLatest")}
            </button>
          )}
        </div>

        {!error && lines.length > 0 && (
          <div className="border-t border-anthracite-100 px-4 py-1.5 text-right text-[11px] text-anthracite-400">
            {t("logsDialog.lineCount", { count: lines.length })}
          </div>
        )}
      </div>
    </div>
  );
}

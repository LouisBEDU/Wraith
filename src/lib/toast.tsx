import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CloseIcon,
  InfoCircleIcon,
  XCircleIcon,
} from "../Components/icons";

export type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: number;
  type: ToastType;
  message: string;
  leaving: boolean;
};

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4500;
const LEAVE_MS = 200;

const ICONS: Record<ToastType, ComponentType<{ className?: string }>> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoCircleIcon,
};

const ICON_WRAP_CLASS: Record<ToastType, string> = {
  success: "bg-status-running-soft text-status-running",
  error: "bg-status-error-soft text-status-error",
  warning: "bg-status-restarting-soft text-status-restarting",
  info: "bg-accent-50 text-accent-600",
};

const PROGRESS_CLASS: Record<ToastType, string> = {
  success: "bg-status-running",
  error: "bg-status-error",
  warning: "bg-status-restarting",
  info: "bg-accent-600",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)),
      );
      window.setTimeout(() => remove(id), LEAVE_MS);
    },
    [remove],
  );

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = idRef.current++;
      setToasts((current) => [...current, { id, type, message, leaving: false }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
    warning: (message) => push("warning", message),
    info: (message) => push("info", message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-100 flex w-full max-w-sm flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              className={`relative overflow-hidden rounded-2xl bg-white border border-anthracite-100 shadow-xl pointer-events-auto flex items-start gap-3 p-4 pr-9 ${
                toast.leaving ? "toast-leave" : "toast-enter"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ICON_WRAP_CLASS[toast.type]}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <p className="flex-1 pt-1 text-sm text-anthracite-900 wrap-break-words">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fermer"
                className="absolute right-2.5 top-2.5 text-anthracite-300 transition-colors hover:text-anthracite-600"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
              {!toast.leaving && (
                <div
                  className={`toast-progress absolute bottom-0 left-0 h-1 ${PROGRESS_CLASS[toast.type]}`}
                  style={{ animationDuration: `${DURATION_MS}ms` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast() doit être utilisé à l'intérieur d'un <ToastProvider>");
  }
  return ctx;
}

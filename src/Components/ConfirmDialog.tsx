import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  if (!open) return null;

  const resolvedConfirm = confirmLabel ?? t("common.confirm");
  const resolvedCancel = cancelLabel ?? t("common.cancel");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-anthracite-950/55 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-sm p-5 flex flex-col gap-4"
      >
        <div>
          <h2 className="text-base font-semibold text-anthracite-900">{title}</h2>
          {description && <p className="text-sm text-anthracite-500 mt-1.5">{description}</p>}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {resolvedCancel}
          </button>
          <button
            type="button"
            className={`btn ${
              danger ? "bg-status-error text-paper hover:bg-status-error/85" : "btn-primary"
            }`}
            onClick={onConfirm}
          >
            {resolvedConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

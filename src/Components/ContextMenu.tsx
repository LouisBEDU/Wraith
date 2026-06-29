import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ContextMenuItem =
  | {
      id: string;
      label: string;
      icon?: ReactNode;
      onSelect: () => void;
      disabled?: boolean;
      danger?: boolean;
    }
  | { type: "separator" };

type ContextMenuProps = {
  items: ContextMenuItem[];
  /** Position du clic (coordonnées viewport). */
  x: number;
  y: number;
  onClose: () => void;
};

const MARGIN = 8;

export default function ContextMenu({ items, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Repositionne le menu pour qu'il reste dans la fenêtre.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let nextX = x;
    let nextY = y;
    if (x + width + MARGIN > window.innerWidth) nextX = window.innerWidth - width - MARGIN;
    if (y + height + MARGIN > window.innerHeight) nextY = window.innerHeight - height - MARGIN;
    setPos({ x: Math.max(MARGIN, nextX), y: Math.max(MARGIN, nextY) });
  }, [x, y]);

  // Ferme sur clic extérieur, Escape, scroll, redimensionnement ou perte de focus.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[100] min-w-44 select-none overflow-hidden rounded-xl border border-anthracite-100 bg-white py-1 shadow-lg"
      style={{ top: pos.y, left: pos.x }}
    >
      {items.map((item, index) => {
        if ("type" in item) {
          return <div key={`sep-${index}`} className="my-1 h-px bg-anthracite-100" />;
        }
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              item.danger
                ? "text-status-error hover:bg-status-error-soft disabled:hover:bg-transparent"
                : "text-anthracite-700 hover:bg-anthracite-100 disabled:hover:bg-transparent"
            }`}
          >
            {item.icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

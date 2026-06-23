import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircleIcon, ChevronDownIcon } from "./icons";

export type SelectOption = { value: string; label: ReactNode };

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
  wrapperClassName?: string;
  ariaLabel?: string;
};

type Coords = { left: number; width: number; top: number; bottom: number; up: boolean };

export default function Select({
  value,
  onChange,
  options,
  disabled = false,
  className = "",
  wrapperClassName = "",
  ariaLabel,
}: SelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((o) => o.value === value);

  function place() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const estimated = Math.min(options.length * 38 + 8, 256);
    const up = spaceBelow < estimated && r.top > spaceBelow;
    setCoords({ left: r.left, width: r.width, top: r.bottom, bottom: window.innerHeight - r.top, up });
  }

  function openMenu() {
    if (disabled) return;
    place();
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(index: number) {
    const opt = options[index];
    if (opt) onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Repositionne juste avant la peinture pour éviter tout saut visuel.
  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fermeture sur clic extérieur, scroll, resize, Échap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return; // scroll interne au panneau
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(activeIndex);
    }
  }

  return (
    <div className={`relative ${wrapperClassName}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white py-2 pl-3 pr-2.5 text-left text-sm text-anthracite-900 transition-colors hover:border-anthracite-200 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "border-accent-500 ring-2 ring-accent-500" : "border-anthracite-100"
        } ${className}`}
      >
        <span className="min-w-0 truncate">{selected?.label ?? value}</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-anthracite-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{
              position: "fixed",
              left: coords.left,
              width: coords.width,
              ...(coords.up ? { bottom: coords.bottom } : { top: coords.top }),
              zIndex: 200,
            }}
            className={`${coords.up ? "mb-1" : "mt-1"} max-h-64 overflow-auto rounded-lg border border-anthracite-100 bg-white py-1 shadow-lg`}
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIndex;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(i)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isActive ? "bg-anthracite-50" : ""
                  } ${isSelected ? "font-medium text-accent-600" : "text-anthracite-900"}`}
                >
                  <span className="min-w-0 truncate">{opt.label}</span>
                  {isSelected && <CheckCircleIcon className="h-4 w-4 shrink-0 text-accent-600" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

import {
  cloneElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom";

type TooltipProps = {
  label: ReactNode;
  /** Élément déclencheur unique (bouton, etc.). */
  children: ReactElement<Record<string, unknown>>;
  placement?: Placement;
  /** Délai avant affichage (ms). */
  delay?: number;
};

const GAP = 8;
const MARGIN = 6;

type Coords = { x: number; y: number; placement: Placement };

export default function Tooltip({
  label,
  children,
  placement = "top",
  delay = 350,
}: TooltipProps) {
  const triggerRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clear();
    timer.current = window.setTimeout(() => setOpen(true), delay);
  }, [clear, delay]);

  const hide = useCallback(() => {
    clear();
    setOpen(false);
  }, [clear]);

  useEffect(() => () => clear(), [clear]);

  // Calcule la position une fois le tooltip monté et mesurable.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;

    const r = trigger.getBoundingClientRect();
    const { width, height } = tip.getBoundingClientRect();

    let place: Placement = placement;
    if (place === "top" && r.top - height - GAP < MARGIN) place = "bottom";
    else if (place === "bottom" && r.bottom + height + GAP > window.innerHeight - MARGIN) place = "top";

    const y = place === "top" ? r.top - height - GAP : r.bottom + GAP;
    let x = r.left + r.width / 2 - width / 2;
    x = Math.min(Math.max(MARGIN, x), window.innerWidth - width - MARGIN);

    setCoords({ x, y, placement: place });
  }, [open, placement, label]);

  // Referme si la fenêtre défile ou est redimensionnée.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  const trigger = cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  });

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            className="pointer-events-none fixed z-[110] rounded-lg bg-anthracite-950 px-2.5 py-1.5 text-xs font-medium text-paper shadow-lg whitespace-nowrap"
            style={{
              top: coords?.y ?? -9999,
              left: coords?.x ?? -9999,
              opacity: coords ? 1 : 0,
              transition: "opacity 0.12s ease",
            }}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}

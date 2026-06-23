import { useEffect, useState } from "react";
import type { Window } from "@tauri-apps/api/window";

type ResizeDirection =
  | "North"
  | "South"
  | "East"
  | "West"
  | "NorthEast"
  | "NorthWest"
  | "SouthEast"
  | "SouthWest";

const HANDLES: { dir: ResizeDirection; className: string }[] = [
  { dir: "North", className: "rh rh-n" },
  { dir: "South", className: "rh rh-s" },
  { dir: "East", className: "rh rh-e" },
  { dir: "West", className: "rh rh-w" },
  { dir: "NorthWest", className: "rh rh-nw" },
  { dir: "NorthEast", className: "rh rh-ne" },
  { dir: "SouthWest", className: "rh rh-sw" },
  { dir: "SouthEast", className: "rh rh-se" },
];

const NEEDS_HANDLES =
  typeof navigator !== "undefined" &&
  /Linux/.test(navigator.userAgent) &&
  !/Android/.test(navigator.userAgent);

export default function WindowResizer() {
  const [appWindow, setAppWindow] = useState<Window>();

  useEffect(() => {
    if (!NEEDS_HANDLES) return;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      setAppWindow(getCurrentWindow());
    });
  }, []);

  if (!NEEDS_HANDLES || !appWindow) return null;

  return (
    <>
      {HANDLES.map((handle) => (
        <div
          key={handle.dir}
          className={handle.className}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            void appWindow.startResizeDragging(handle.dir);
          }}
        />
      ))}
    </>
  );
}

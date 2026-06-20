import { useEffect, useState } from 'react';
import type { Window } from "@tauri-apps/api/window";

export default function Titlebar() {
  const [appWindow, setAppWindow] = useState<Window>();

  useEffect(() => {
    import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      setAppWindow(win);
    });
  }, []);

  if (!appWindow) return;

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  return (
    <div className="titlebar">
      <div data-tauri-drag-region className="title">
        <img className="icon-chip" src="/wraith.svg" alt="" />
        <span className="app-name">{import.meta.env.VITE_APP_NAME}</span>
      </div>
      <div className="controls">
        <button onClick={handleMinimize} title="Réduire">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#faf9f6"><path d="M280-160q-8.5 0-14.25-5.76T260-180.03q0-8.51 5.75-14.24T280-200h400q8.5 0 14.25 5.76t5.75 14.27q0 8.51-5.75 14.24T680-160H280Z"/></svg>
        </button>
        <button onClick={handleMaximize} title="Agrandir">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#faf9f6"><path d="M224.62-160q-27.62 0-46.12-18.5Q160-197 160-224.62v-510.76q0-27.62 18.5-46.12Q197-800 224.62-800h510.76q27.62 0 46.12 18.5Q800-763 800-735.38v510.76q0 27.62-18.5 46.12Q763-160 735.38-160H224.62Zm0-40h510.76q9.24 0 16.93-7.69 7.69-7.69 7.69-16.93v-510.76q0-9.24-7.69-16.93-7.69-7.69-16.93-7.69H224.62q-9.24 0-16.93 7.69-7.69 7.69-7.69 16.93v510.76q0 9.24 7.69 16.93 7.69 7.69 16.93 7.69Z"/></svg>
        </button>
        <button onClick={handleClose} title="Fermer" className="close-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#faf9f6"><path d="M480-451.69 270.15-241.85q-5.61 5.62-13.77 6-8.15.39-14.53-6-6.39-6.38-6.39-14.15 0-7.77 6.39-14.15L451.69-480 241.85-689.85q-5.62-5.61-6-13.77-.39-8.15 6-14.53 6.38-6.39 14.15-6.39 7.77 0 14.15 6.39L480-508.31l209.85-209.84q5.61-5.62 13.77-6 8.15-.39 14.53 6 6.39 6.38 6.39 14.15 0 7.77-6.39 14.15L508.31-480l209.84 209.85q5.62 5.61 6 13.77.39 8.15-6 14.53-6.38 6.39-14.15 6.39-7.77 0-14.15-6.39L480-451.69Z"/></svg>
        </button>
      </div>
    </div>
  );
}

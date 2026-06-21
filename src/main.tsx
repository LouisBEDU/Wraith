import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import App from "./Pages/App";
import { ToastProvider } from "./lib/toast";
import { UpdateProvider } from "./lib/update";
import { SystemToolsProvider } from "./lib/systemTools";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <UpdateProvider>
        <SystemToolsProvider>
          <App />
        </SystemToolsProvider>
      </UpdateProvider>
    </ToastProvider>
  </React.StrictMode>,
);

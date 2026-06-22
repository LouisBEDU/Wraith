import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import App from "./Pages/App";
import { ToastProvider } from "./lib/toast";
import { UpdateProvider } from "./lib/update";
import { SystemToolsProvider } from "./lib/systemTools";
import { ConnectionsProvider } from "./lib/connections";
import { DockerDataProvider } from "./lib/dockerData";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <UpdateProvider>
        <ConnectionsProvider>
          <SystemToolsProvider>
            <DockerDataProvider>
              <App />
            </DockerDataProvider>
          </SystemToolsProvider>
        </ConnectionsProvider>
      </UpdateProvider>
    </ToastProvider>
  </React.StrictMode>,
);

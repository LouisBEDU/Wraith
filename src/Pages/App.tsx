import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "./App.css";
import Content from "../Components/Content";
import Images from "../Components/Images";
import LoginScreen from "../Components/LoginScreen";
import Navbar, { type Page } from "../Components/Navbar";
import Networks from "../Components/Networks";
import Ports from "../Components/Ports";
import Settings from "../Components/Settings";
import Titlebar from "../Components/Titlebar";
import Volumes from "../Components/Volumes";
import { checkSession, isTauri } from "../lib/api";

const PAGES: Record<Page, ReactNode> = {
  containers: <Content />,
  images: <Images />,
  volumes: <Volumes />,
  networks: <Networks />,
  ports: <Ports />,
  settings: <Settings />,
};

export default function App() {
  const { t } = useTranslation();
  const [page, setPage] = useState<Page>("containers");

  const [authenticated, setAuthenticated] = useState(isTauri);
  const [checkingSession, setCheckingSession] = useState(!isTauri);

  useEffect(() => {
    if (isTauri) return;
    checkSession()
      .then(setAuthenticated)
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (isTauri) return;
    const onUnauthorized = () => setAuthenticated(false);
    window.addEventListener("wraith:unauthorized", onUnauthorized);
    return () => window.removeEventListener("wraith:unauthorized", onUnauthorized);
  }, []);

  if (!isTauri && checkingSession) {
    return (
      <main className="h-screen flex items-center justify-center bg-anthracite-950 text-sm text-paper/50">
        {t("app.loading")}
      </main>
    );
  }

  if (!isTauri && !authenticated) {
    return <LoginScreen onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <main className="h-screen flex flex-col bg-paper">
      {isTauri && <Titlebar />}
      <div className="flex-1 min-h-0 flex">
        <Navbar page={page} onNavigate={setPage} />
        {PAGES[page]}
      </div>
    </main>
  );
}
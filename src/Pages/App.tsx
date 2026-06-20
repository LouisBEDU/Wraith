import { useEffect, useState } from "react";
import "./App.css";
import Content from "../Components/Content";
import LoginScreen from "../Components/LoginScreen";
import Navbar, { type Page } from "../Components/Navbar";
import Settings from "../Components/Settings";
import Titlebar from "../Components/Titlebar";
import { checkSession, isTauri } from "../lib/api";

export default function App() {
  const [page, setPage] = useState<Page>("containers");

  // En mode desktop (Tauri), pas d'auth du tout. En mode web, l'app reste
  // cachée derrière l'écran de connexion jusqu'à ce que la session soit
  // vérifiée auprès du serveur embarqué (cookie `wraith_session`).
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
        Chargement…
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
        {page === "settings" ? <Settings /> : <Content />}
      </div>
    </main>
  );
}
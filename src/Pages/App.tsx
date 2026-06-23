import { useState, type ReactNode } from "react";
import "./App.css";
import Content from "../Components/Content";
import Images from "../Components/Images";
import Navbar, { type Page } from "../Components/Navbar";
import Networks from "../Components/Networks";
import Ports from "../Components/Ports";
import Settings from "../Components/Settings";
import Titlebar from "../Components/Titlebar";
import Volumes from "../Components/Volumes";
import WindowResizer from "../Components/WindowResizer";

const PAGES: Record<Page, ReactNode> = {
  containers: <Content />,
  images: <Images />,
  volumes: <Volumes />,
  networks: <Networks />,
  ports: <Ports />,
  settings: <Settings />,
};

export default function App() {
  const [page, setPage] = useState<Page>("containers");

  return (
    <main className="h-screen flex flex-col bg-paper">
      <WindowResizer />
      <Titlebar />
      <div className="flex-1 min-h-0 flex">
        <Navbar page={page} onNavigate={setPage} />
        {PAGES[page]}
      </div>
    </main>
  );
}

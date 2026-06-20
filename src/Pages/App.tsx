import "./App.css";
import Content from "../Components/Content";
import Navbar from "../Components/Navbar";
import Titlebar from "../Components/Titlebar";

export default function App() {
  return (
    <main className="h-screen flex flex-col bg-paper">
      <Titlebar />
      <div className="flex-1 min-h-0 flex">
        <Navbar />
        <Content />
      </div>
    </main>
  );
}
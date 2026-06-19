import "./App.css";

export default function App() {
  return (
    <main className="flex p-4 gap-4">
      <nav className="bg-slate-900 p-4 rounded-lg">
        {import.meta.env.VITE_APP_NAME}
      </nav>
      <section className="bg-slate-900 p-4 rounded-lg flex-1">MAIN</section>
    </main>
  );
}

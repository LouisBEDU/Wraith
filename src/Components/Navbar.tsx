export default function Navbar() {
  return (
    <nav className="bg-slate-900 p-4 rounded-lg">
      {import.meta.env.VITE_APP_NAME}
    </nav>
  );
}

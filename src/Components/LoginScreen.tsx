import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { login } from "../lib/api";
import { LogoIcon } from "./icons";

type LoginScreenProps = {
  onSuccess: () => void;
};

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const ok = await login(password);
      if (ok) {
        onSuccess();
      } else {
        setError(t("login.wrongPassword"));
      }
    } catch {
      setError(t("login.serverError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="h-screen flex items-center justify-center bg-anthracite-950 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-anthracite-900 border border-white/10 p-6 flex flex-col gap-5 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-2 text-paper">
          <LogoIcon className="h-9 w-9 text-accent-400" />
          <h1 className="text-base font-semibold">{t("login.appName")}</h1>
          <p className="text-sm text-paper/50 text-center">{t("login.subtitle")}</p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-paper/80">{t("login.password")}</span>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-lg border border-white/10 bg-anthracite-800 px-3 py-2 text-sm text-paper placeholder:text-paper/30 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </label>

        {error && (
          <div className="rounded-lg border border-status-error/30 bg-status-error/10 text-status-error text-sm px-3 py-2">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? t("login.connecting") : t("login.submit")}
        </button>
      </form>
    </main>
  );
}

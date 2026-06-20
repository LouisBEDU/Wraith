import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getLocalIp,
  getWebServerSettings,
  isTauri,
  saveWebServerSettings,
  type WebServerSettings,
} from "../lib/api";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<WebServerSettings | null>(null);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Les paramètres ne sont modifiables que depuis l'app desktop : en mode
  // web (servi par le serveur embarqué), invoke() n'existe pas.
  useEffect(() => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [loaded, ip] = await Promise.all([
          getWebServerSettings(),
          getLocalIp().catch(() => null),
        ]);
        setSettings(loaded);
        setLocalIp(ip);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveWebServerSettings(settings);
      setSaved(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  const currentLang = i18n.language?.startsWith("en") ? "en" : "fr";

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
      <div>
        <h1 className="text-xl font-semibold text-anthracite-900">{t("settings.title")}</h1>
        <p className="text-sm text-anthracite-500 mt-0.5">{t("settings.subtitle")}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-status-error/20 bg-status-error-soft text-status-error text-sm px-4 py-3 wrap-break-words">
          {error}
        </div>
      )}

      <div className="card max-w-lg p-5 flex flex-col gap-3">
        <span className="text-sm font-medium text-anthracite-900">{t("settings.language")}</span>
        <select
          value={currentLang}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="rounded-lg border border-anthracite-100 px-3 py-2 text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="fr">{t("settings.languageFrench")}</option>
          <option value="en">{t("settings.languageEnglish")}</option>
        </select>
      </div>

      {!isTauri ? (
        <div className="card max-w-lg p-5 text-sm text-anthracite-500">
          {t("settings.webOnlyDesktop")}
        </div>
      ) : loading || !settings ? (
        <p className="text-sm text-anthracite-500">{t("settings.loading")}</p>
      ) : (
        <div className="card max-w-lg p-5 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-anthracite-900">{t("settings.webAccess")}</p>
              <p className="text-sm text-anthracite-500 mt-0.5">
                {t("settings.webAccessDescription")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                settings.enabled ? "bg-accent-600" : "bg-anthracite-200"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-anthracite-900">{t("settings.port")}</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={settings.port}
              onChange={(e) =>
                setSettings({ ...settings, port: Number(e.target.value) || 0 })
              }
              className="rounded-lg border border-anthracite-100 px-3 py-2 text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-anthracite-900">{t("settings.password")}</span>
            <input
              type="password"
              value={settings.password}
              onChange={(e) => setSettings({ ...settings, password: e.target.value })}
              placeholder={t("settings.passwordPlaceholder")}
              className="rounded-lg border border-anthracite-100 px-3 py-2 text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            <span className="text-xs text-anthracite-400">{t("settings.passwordHint")}</span>
          </label>

          {settings.enabled && localIp && (
            <div className="rounded-lg bg-anthracite-50 px-3 py-2 text-sm text-anthracite-600">
              {t("settings.networkHint")}{" "}
              <code className="text-anthracite-900">
                http://{localIp}:{settings.port}
              </code>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? t("settings.saving") : t("settings.save")}
            </button>
            {saved && <span className="text-sm text-status-running">{t("settings.saved")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

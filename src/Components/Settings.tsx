import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getLocalIp,
  getWebServerSettings,
  isTauri,
  saveWebServerSettings,
  type WebServerSettings,
} from "../lib/api";
import { useToast } from "../lib/toast";
import { useUpdate } from "../lib/update";
import { DownloadIcon, EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon } from "./icons";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const update = useUpdate();
  const [settings, setSettings] = useState<WebServerSettings | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [ipRevealed, setIpRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        toast.error(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    if (!settings) return;
    const settingNewPassword = passwordInput !== "";
    const willHaveNoPassword = !settings.has_password && !settingNewPassword;

    if (!Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535) {
      toast.error(t("settings.toastInvalidPort"));
      return;
    }
    // L'accès web pilote Docker sur le réseau : on refuse de l'activer sans
    // mot de passe (le backend applique aussi cette règle).
    if (settings.enabled && willHaveNoPassword) {
      toast.error(t("settings.toastPasswordRequired"));
      return;
    }

    setSaving(true);
    try {
      await saveWebServerSettings({
        enabled: settings.enabled,
        port: settings.port,
        run_in_background: settings.run_in_background,
        password: settingNewPassword ? passwordInput : null,
      });
      if (settingNewPassword) {
        setSettings({ ...settings, has_password: true });
        setPasswordInput("");
      }
      toast.success(t("settings.toastSaved"));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleClearPassword() {
    if (!settings) return;
    // Impossible de retirer le mot de passe tant que l'accès web est actif :
    // il faut d'abord désactiver l'accès web.
    if (settings.enabled) {
      toast.error(t("settings.toastPasswordRequired"));
      return;
    }
    setSaving(true);
    try {
      await saveWebServerSettings({
        enabled: settings.enabled,
        port: settings.port,
        run_in_background: settings.run_in_background,
        password: "",
      });
      setSettings({ ...settings, has_password: false });
      setPasswordInput("");
      toast.info(t("settings.toastPasswordRemoved"));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  }

  const currentLang = i18n.language?.startsWith("en") ? "en" : "fr";

  async function handleInstallUpdate() {
    try {
      await update.install();
    } catch (err) {
      toast.error(String(err));
    }
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
      {update.available && (
        <div className="card max-w-lg p-4 flex items-center justify-between gap-4 border-accent-100 bg-accent-50">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-600">
              <DownloadIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-anthracite-900">
                {t("settings.updateAvailable", { version: update.version })}
              </p>
              <p className="text-sm text-anthracite-500 mt-0.5">
                {t("settings.updateDescription")}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary shrink-0"
            onClick={handleInstallUpdate}
            disabled={update.installing}
          >
            {update.installing ? t("settings.updateInstalling") : t("settings.updateButton")}
          </button>
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold text-anthracite-900">{t("settings.title")}</h1>
        <p className="text-sm text-anthracite-500 mt-0.5">{t("settings.subtitle")}</p>
      </div>

      <div className="card max-w-lg p-5 flex flex-col gap-3">
        <span className="text-sm font-medium text-anthracite-900">{t("settings.language")}</span>
        <select
          value={currentLang}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="rounded-lg border border-anthracite-100 px-3 py-2 text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="en">{t("settings.languageEnglish")}</option>
          <option value="fr">{t("settings.languageFrench")}</option>
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
              <p className="text-sm font-medium text-anthracite-900">
                {t("settings.runInBackground")}
              </p>
              <p className="text-sm text-anthracite-500 mt-0.5">
                {t("settings.runInBackgroundDescription")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.run_in_background}
              onClick={() =>
                setSettings({ ...settings, run_in_background: !settings.run_in_background })
              }
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                settings.run_in_background ? "bg-accent-600" : "bg-anthracite-200"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.run_in_background ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

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
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-anthracite-900">{t("settings.password")}</span>
              <span className={`badge ${settings.has_password ? "badge-running" : "badge-restarting"}`}>
                {settings.has_password ? (
                  <LockIcon className="h-3 w-3" />
                ) : (
                  <LockOpenIcon className="h-3 w-3" />
                )}
                {settings.has_password
                  ? t("settings.passwordBadgeSet")
                  : t("settings.passwordBadgeUnset")}
              </span>
            </div>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder={
                settings.has_password
                  ? t("settings.passwordPlaceholderSet")
                  : t("settings.passwordPlaceholder")
              }
              className="rounded-lg border border-anthracite-100 px-3 py-2 text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            <span className="text-xs text-anthracite-400">{t("settings.passwordHint")}</span>
            {settings.has_password && (
              <button
                type="button"
                onClick={handleClearPassword}
                disabled={saving}
                className="self-start text-xs text-status-error hover:underline disabled:opacity-40"
              >
                {t("settings.passwordClear")}
              </button>
            )}
          </label>

          {settings.enabled && localIp && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-anthracite-50 px-3 py-2 text-sm text-anthracite-600">
              <span>
                {t("settings.networkHint")}{" "}
                <code
                  className={`text-anthracite-900 transition-all duration-150 ${
                    ipRevealed ? "" : "blur-sm select-none"
                  }`}
                >
                  http://{localIp}:{settings.port}
                </code>
              </span>
              <button
                type="button"
                onClick={() => setIpRevealed((v) => !v)}
                title={ipRevealed ? t("settings.hideIp") : t("settings.showIp")}
                className="icon-btn shrink-0"
              >
                {ipRevealed ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? t("settings.saving") : t("settings.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

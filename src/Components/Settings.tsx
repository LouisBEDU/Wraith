import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  getLocalIp,
  getWebServerSettings,
  isTauri,
  saveWebServerSettings,
  type WebServerSettings,
} from "../lib/api";
import ConnectionsManager from "./ConnectionsManager";
import { useToast } from "../lib/toast";
import { useUpdate } from "../lib/update";
import { useSystemTools } from "../lib/systemTools";
import {
  CheckCircleIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  LockOpenIcon,
  XCircleIcon,
} from "./icons";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const update = useUpdate();
  const { tools } = useSystemTools();
  const [settings, setSettings] = useState<WebServerSettings | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [ipRevealed, setIpRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const baselineRef = useRef<{ enabled: boolean; port: number }>({ enabled: false, port: 0 });

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
        baselineRef.current = { enabled: loaded.enabled, port: loaded.port };
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
      baselineRef.current = { enabled: settings.enabled, port: settings.port };
      toast.success(t("settings.toastSaved"));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleClearPassword() {
    if (!settings) return;
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

  async function handleToggleBackground() {
    if (!settings || saving) return;
    const next = !settings.run_in_background;
    setSettings({ ...settings, run_in_background: next });
    setSaving(true);
    try {
      await saveWebServerSettings({
        enabled: baselineRef.current.enabled,
        port: baselineRef.current.port,
        run_in_background: next,
        password: null,
      });
      toast.success(t("settings.toastSaved"));
    } catch (err) {
      setSettings((s) => (s ? { ...s, run_in_background: !next } : s));
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

      <div className="gap-5 sm:gap-6 md:columns-2 xl:columns-3">
      {isTauri && tools && (
        <SettingsSection title={t("settings.toolsTitle")}>
          <div className="card p-5 flex flex-col gap-3">
            <ToolRow
              label="Docker"
              ok={tools.docker}
              okText={t("settings.toolInstalled")}
              koText={t("settings.toolMissing")}
            />
            <ToolRow
              label={t("settings.toolFirewall", { backend: tools.firewall.backend })}
              ok={tools.firewall.available}
              okText={t("settings.toolInstalled")}
              koText={t("settings.toolMissing")}
            />
            <ToolRow
              label={t("settings.toolSsh")}
              ok={tools.ssh.installed}
              okText={t("settings.toolInstalled")}
              koText={t("settings.toolMissing")}
            />
            {tools.firewall.message && (
              <p className="text-xs text-anthracite-500">{tools.firewall.message}</p>
            )}
          </div>
        </SettingsSection>
      )}
      <SettingsSection title={t("settings.generalTitle")} description={t("settings.generalSubtitle")}>
        <div className="card p-5 flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-anthracite-900">{t("settings.language")}</span>
            <select
              value={currentLang}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="rounded-lg border border-anthracite-100 px-3 py-2 text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="en">{t("settings.languageEnglish")}</option>
              <option value="fr">{t("settings.languageFrench")}</option>
            </select>
          </label>

          {isTauri && settings && (
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
                disabled={saving}
                onClick={handleToggleBackground}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
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
          )}
        </div>
      </SettingsSection>

      {isTauri && (
        <SettingsSection title={t("conn.title")} description={t("conn.subtitle")}>
          <ConnectionsManager />
        </SettingsSection>
      )}

      {!isTauri ? (
        <SettingsSection title={t("settings.webAccessTitle")}>
          <div className="card p-5 text-sm text-anthracite-500">
            {t("settings.webOnlyDesktop")}
          </div>
        </SettingsSection>
      ) : loading || !settings ? (
        <SettingsSection title={t("settings.webAccessTitle")}>
          <div className="card p-5 text-sm text-anthracite-500">{t("settings.loading")}</div>
        </SettingsSection>
      ) : (
        <SettingsSection
          title={t("settings.webAccessTitle")}
          description={t("settings.webAccessDescription")}
        >
        <div className="card p-5 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-anthracite-900">{t("settings.webAccessEnable")}</p>
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
        </SettingsSection>
      )}
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-5 flex break-inside-avoid flex-col gap-3 sm:mb-6">
      <div className="px-0.5">
        <h2 className="text-sm font-semibold text-anthracite-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-anthracite-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ToolRow({
  label,
  ok,
  okText,
  koText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  koText: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-anthracite-600">{label}</span>
      <span
        className={`flex items-center gap-1.5 font-medium ${
          ok ? "text-status-running" : "text-status-error"
        }`}
      >
        {ok ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
        {ok ? okText : koText}
      </span>
    </div>
  );
}

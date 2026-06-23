import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import ConnectionsManager from "./ConnectionsManager";
import Select from "./Select";
import { useToast } from "../lib/toast";
import { useUpdate } from "../lib/update";
import { useSystemTools } from "../lib/systemTools";
import { CheckCircleIcon, DownloadIcon, XCircleIcon } from "./icons";

const APP_VERSION = import.meta.env.VITE_APP_VERSION as string | undefined;

export default function Settings() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const update = useUpdate();
  const { tools } = useSystemTools();

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
      <div>
        <h1 className="text-xl font-semibold text-anthracite-900">{t("settings.title")}</h1>
        <p className="text-sm text-anthracite-500 mt-0.5">{t("settings.subtitle")}</p>
      </div>

      {update.available && (
        <div className="card max-w-3xl p-4 flex items-center justify-between gap-4 border-accent-100 bg-accent-50">
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

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-5 sm:gap-6">
          <SettingsSection
            title={t("settings.generalTitle")}
            description={t("settings.generalSubtitle")}
          >
            <div className="card p-5 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-anthracite-900">
                  {t("settings.language")}
                </span>
                <Select
                  value={currentLang}
                  onChange={(v) => i18n.changeLanguage(v)}
                  ariaLabel={t("settings.language")}
                  options={[
                    { value: "en", label: t("settings.languageEnglish") },
                    { value: "fr", label: t("settings.languageFrench") },
                  ]}
                />
              </label>

              <div className="flex items-center justify-between gap-3 border-t border-anthracite-100 pt-4">
                <span className="text-sm text-anthracite-600">{t("settings.version")}</span>
                <span className="font-mono text-xs text-anthracite-500">
                  {APP_VERSION ? `v${APP_VERSION}` : "—"}
                </span>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title={t("settings.toolsTitle")}>
            <div className="card p-5 flex flex-col gap-3">
              <ToolRow
                label="Docker"
                ok={!!tools?.docker}
                okText={t("settings.toolInstalled")}
                koText={t("settings.toolMissing")}
              />
              <ToolRow
                label={t("settings.toolFirewall", { backend: tools?.firewall.backend ?? "—" })}
                ok={!!tools?.firewall.available}
                okText={t("settings.toolInstalled")}
                koText={t("settings.toolMissing")}
              />
              <ToolRow
                label={t("settings.toolSsh")}
                ok={!!tools?.ssh.installed}
                okText={t("settings.toolInstalled")}
                koText={t("settings.toolMissing")}
              />
              {tools?.firewall.message && (
                <p className="text-xs text-anthracite-500">{tools.firewall.message}</p>
              )}
            </div>
          </SettingsSection>
        </div>

        <SettingsSection title={t("conn.title")} description={t("conn.subtitle")}>
          <ConnectionsManager />
        </SettingsSection>
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
    <section className="flex flex-col gap-3">
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

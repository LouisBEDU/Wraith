import { useEffect, useState } from "react";
import {
  getLocalIp,
  getWebServerSettings,
  isTauri,
  saveWebServerSettings,
  type WebServerSettings,
} from "../lib/api";

export default function Settings() {
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

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
      <div>
        <h1 className="text-xl font-semibold text-anthracite-900">Paramètres</h1>
        <p className="text-sm text-anthracite-500 mt-0.5">
          Configure l'accès web à Wraith.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-status-error/20 bg-status-error-soft text-status-error text-sm px-4 py-3 wrap-break-words">
          {error}
        </div>
      )}

      {!isTauri ? (
        <div className="card max-w-lg p-5 text-sm text-anthracite-500">
          Les paramètres ne sont modifiables que depuis l'app desktop Wraith,
          pas depuis cet accès web.
        </div>
      ) : loading || !settings ? (
        <p className="text-sm text-anthracite-500">Chargement…</p>
      ) : (
        <div className="card max-w-lg p-5 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-anthracite-900">Accès web</p>
              <p className="text-sm text-anthracite-500 mt-0.5">
                Expose Wraith sur le réseau pour le piloter depuis un navigateur,
                en plus de l'app desktop.
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
            <span className="text-sm font-medium text-anthracite-900">Port</span>
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
            <span className="text-sm font-medium text-anthracite-900">Mot de passe</span>
            <input
              type="password"
              value={settings.password}
              onChange={(e) => setSettings({ ...settings, password: e.target.value })}
              placeholder="Laisser vide = accès libre (déconseillé hors localhost)"
              className="rounded-lg border border-anthracite-100 px-3 py-2 text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            <span className="text-xs text-anthracite-400">
              Demandé via l'écran de connexion Wraith au premier accès
              depuis le navigateur.
            </span>
          </label>

          {settings.enabled && localIp && (
            <div className="rounded-lg bg-anthracite-50 px-3 py-2 text-sm text-anthracite-600">
              Accessible depuis le réseau à l'adresse{" "}
              <code className="text-anthracite-900">
                http://{localIp}:{settings.port}
              </code>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {saved && <span className="text-sm text-status-running">Enregistré.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

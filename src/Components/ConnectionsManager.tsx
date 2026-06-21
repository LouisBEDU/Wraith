import { useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteConnection, saveConnection, testConnection } from "../lib/api";
import { useConnections } from "../lib/connections";
import { useToast } from "../lib/toast";
import type { AuthMethod, ConnectionProfile } from "../types/connection";
import { CheckCircleIcon, TrashIcon } from "./icons";

type FormState = {
  id: string | null;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  keyPath: string;
  secret: string;
  sudoPassword: string;
};

const EMPTY: FormState = {
  id: null,
  name: "",
  host: "",
  port: 22,
  username: "",
  authMethod: "key",
  keyPath: "",
  secret: "",
  sudoPassword: "",
};

const inputClass =
  "rounded-lg border border-anthracite-100 px-3 py-2 text-sm text-anthracite-900 focus:outline-none focus:ring-2 focus:ring-accent-500";

export default function ConnectionsManager() {
  const { t } = useTranslation();
  const toast = useToast();
  const { connections, activeId, refresh, setActive } = useConnections();
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  function edit(p: ConnectionProfile) {
    setForm({
      id: p.id,
      name: p.name,
      host: p.host,
      port: p.port,
      username: p.username,
      authMethod: p.auth_method,
      keyPath: p.key_path ?? "",
      secret: "",
      sudoPassword: "",
    });
  }

  function resetForm() {
    setForm({ ...EMPTY });
  }

  async function handleSave() {
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
      toast.error(t("conn.fillRequired"));
      return;
    }
    setSaving(true);
    try {
      await saveConnection({
        id: form.id,
        name: form.name.trim(),
        host: form.host.trim(),
        port: form.port || 22,
        username: form.username.trim(),
        authMethod: form.authMethod,
        keyPath: form.authMethod === "key" ? form.keyPath || null : null,
        secret: form.secret || null,
        sudoPassword: form.sudoPassword || null,
      });
      toast.success(t("conn.saved"));
      resetForm();
      await refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!form.host.trim() || !form.username.trim()) {
      toast.error(t("conn.fillRequired"));
      return;
    }
    setTesting(true);
    try {
      const res = await testConnection({
        host: form.host.trim(),
        port: form.port || 22,
        username: form.username.trim(),
        authMethod: form.authMethod,
        secret: form.secret || null,
        keyPath: form.authMethod === "key" ? form.keyPath || null : null,
      });
      toast.success(t("conn.testOk", { version: res }));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setTesting(false);
    }
  }

  async function handleConnect(id: string | null) {
    try {
      await setActive(id);
      toast.success(id ? t("conn.connected") : t("conn.usingLocal"));
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function handleDelete(p: ConnectionProfile) {
    try {
      await deleteConnection(p.id);
      if (form.id === p.id) resetForm();
      toast.info(t("conn.deleted"));
      await refresh();
    } catch (e) {
      toast.error(String(e));
    }
  }

  return (
    <div className="card max-w-lg p-5 flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-anthracite-900">{t("conn.title")}</p>
        <p className="text-sm text-anthracite-500 mt-0.5">{t("conn.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-anthracite-100 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-anthracite-900">{t("conn.local")}</p>
            <p className="truncate text-xs text-anthracite-400">{t("conn.localHint")}</p>
          </div>
          {activeId === null ? (
            <span className="badge badge-running shrink-0">
              <CheckCircleIcon className="h-3 w-3" />
              {t("conn.active")}
            </span>
          ) : (
            <button
              type="button"
              className="btn btn-ghost shrink-0 px-2.5 py-1 text-xs"
              onClick={() => handleConnect(null)}
            >
              {t("conn.use")}
            </button>
          )}
        </div>

        {connections.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 rounded-lg border border-anthracite-100 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-anthracite-900">{p.name}</p>
              <p className="truncate text-xs text-anthracite-400">
                {p.username}@{p.host}:{p.port}
              </p>
            </div>
            {activeId === p.id ? (
              <span className="badge badge-running shrink-0">
                <CheckCircleIcon className="h-3 w-3" />
                {t("conn.active")}
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-ghost shrink-0 px-2.5 py-1 text-xs"
                onClick={() => handleConnect(p.id)}
              >
                {t("conn.use")}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost shrink-0 px-2.5 py-1 text-xs"
              onClick={() => edit(p)}
            >
              {t("conn.edit")}
            </button>
            <button
              type="button"
              className="icon-btn shrink-0 hover:bg-status-error-soft! hover:text-status-error!"
              title={t("conn.delete")}
              onClick={() => handleDelete(p)}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-anthracite-100 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-anthracite-400">
          {form.id ? t("conn.editTitle") : t("conn.addTitle")}
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-anthracite-500">{t("conn.name")}</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("conn.namePlaceholder")}
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-anthracite-500">{t("conn.host")}</span>
            <input
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              placeholder="192.168.1.10"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-anthracite-500">{t("conn.port")}</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={form.port}
              onChange={(e) => setForm({ ...form, port: Number(e.target.value) || 0 })}
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-anthracite-500">{t("conn.user")}</span>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="root"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-anthracite-500">{t("conn.auth")}</span>
            <select
              value={form.authMethod}
              onChange={(e) => setForm({ ...form, authMethod: e.target.value as AuthMethod })}
              className={inputClass}
            >
              <option value="key">{t("conn.authKey")}</option>
              <option value="password">{t("conn.authPassword")}</option>
            </select>
          </label>
        </div>

        {form.authMethod === "key" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-anthracite-500">{t("conn.keyPath")}</span>
              <input
                value={form.keyPath}
                onChange={(e) => setForm({ ...form, keyPath: e.target.value })}
                placeholder="C:\Users\me\.ssh\id_ed25519"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-anthracite-500">{t("conn.passphrase")}</span>
              <input
                type="password"
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                placeholder={form.id ? t("conn.secretKeep") : t("conn.optional")}
                className={inputClass}
              />
            </label>
          </div>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-anthracite-500">{t("conn.password")}</span>
            <input
              type="password"
              value={form.secret}
              onChange={(e) => setForm({ ...form, secret: e.target.value })}
              placeholder={form.id ? t("conn.secretKeep") : ""}
              className={inputClass}
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-anthracite-500">{t("conn.sudoPassword")}</span>
          <input
            type="password"
            value={form.sudoPassword}
            onChange={(e) => setForm({ ...form, sudoPassword: e.target.value })}
            placeholder={form.id ? t("conn.secretKeep") : t("conn.sudoHint")}
            className={inputClass}
          />
          <span className="text-[11px] text-anthracite-400">{t("conn.sudoNote")}</span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t("conn.saving") : t("conn.save")}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? t("conn.testing") : t("conn.test")}
          </button>
          {form.id && (
            <button type="button" className="btn btn-ghost" onClick={resetForm}>
              {t("conn.cancel")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

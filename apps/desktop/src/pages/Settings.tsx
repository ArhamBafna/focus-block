import { useState, useEffect } from "react";
import { ipc, AppSettings } from "../lib/ipc";

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: "44px",
        height: "24px",
        borderRadius: "100px",
        background: checked ? "var(--color-fathom)" : "var(--color-neutral-200)",
        border: "none",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        transition: "background 0.2s ease",
      }}
    >
      <span
        style={{
          display: "block",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transform: checked ? "translateX(23px)" : "translateX(3px)",
          transition: "transform 0.2s ease",
        }}
      />
    </button>
  );
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 14px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-lumen-dark)",
        borderRadius: "10px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-vast)", marginBottom: "3px" }}>
          {title}
        </div>
        <div style={{ fontSize: "11px", color: "var(--color-neutral-500)", lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
      <div style={{ flexShrink: 0, paddingTop: "1px" }}>{control}</div>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    ipc.getSettings().then(setSettings).catch(console.error);
  }, []);

  const toggleOsAllowlist = async () => {
    if (!settings || saving) return;
    const newVal = !settings.os_allowlist_enabled;
    setSaving(true);
    setSaveError(null);
    try {
      await ipc.updateSettings(newVal);
      setSettings({ ...settings, os_allowlist_enabled: newVal });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save setting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "380px" }}>
      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-vast)", margin: 0, letterSpacing: "-0.3px" }}>
          Settings
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-neutral-500)" }}>
          Configure how Focus Blocker behaves.
        </p>
      </div>

      {settings === null ? (
        <div style={{ color: "var(--color-neutral-400)", fontSize: "13px" }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SettingRow
            title="OS Essentials Allowlist"
            description="Allow essential Windows services even during Lockdown mode."
            control={
              <Toggle
                checked={settings.os_allowlist_enabled}
                onChange={toggleOsAllowlist}
              />
            }
          />
          {saveError && (
            <div role="alert" style={{ padding: "8px 12px", background: "#fff0f0", border: "1px solid #f8d0d0", borderRadius: "8px", fontSize: "12px", color: "var(--color-pulse)" }}>
              {saveError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

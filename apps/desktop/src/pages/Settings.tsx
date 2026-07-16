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
        alignItems: "center",
        justifyContent: "space-between",
        gap: "24px",
        padding: "18px 20px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-lumen-dark)",
        borderRadius: "12px",
      }}
    >
      <div>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-vast)", marginBottom: "3px" }}>
          {title}
        </div>
        <div style={{ fontSize: "13px", color: "var(--color-neutral-500)", lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
      {control}
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ipc.getSettings().then(setSettings).catch(console.error);
  }, []);

  const toggleOsAllowlist = async () => {
    if (!settings || saving) return;
    const newVal = !settings.os_allowlist_enabled;
    setSaving(true);
    try {
      await ipc.updateSettings(newVal);
      setSettings({ ...settings, os_allowlist_enabled: newVal });
    } catch (e) {
      alert("Failed to save setting: " + e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: "720px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-vast)", margin: 0, letterSpacing: "-0.4px" }}>
          Settings
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--color-neutral-500)" }}>
          Configure how Focus Blocker behaves.
        </p>
      </div>

      {settings === null ? (
        <div style={{ color: "var(--color-neutral-400)", fontSize: "14px" }}>Loading settings…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <SettingRow
            title="OS Essentials Allowlist"
            description="Allow essential Windows services (Windows Update, NTP, Microsoft connectivity tests) even during Lockdown mode."
            control={
              <Toggle
                checked={settings.os_allowlist_enabled}
                onChange={toggleOsAllowlist}
              />
            }
          />
        </div>
      )}
    </div>
  );
}

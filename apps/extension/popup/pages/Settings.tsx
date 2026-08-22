import { useState, useEffect } from "react";
import { Info } from "@phosphor-icons/react";
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
  layout = "horizontal",
}: {
  title: React.ReactNode;
  description: string;
  control: React.ReactNode;
  layout?: "horizontal" | "vertical";
}) {
  const hasDescription = Boolean(description);
  const isVertical = layout === "vertical";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isVertical ? "column" : "row",
        alignItems: isVertical ? "stretch" : (hasDescription ? "flex-start" : "center"),
        justifyContent: "space-between",
        gap: isVertical ? "8px" : "12px",
        padding: "12px 14px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-lumen-dark)",
        borderRadius: "10px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-vast)", marginBottom: hasDescription ? "3px" : 0 }}>
          {title}
        </div>
        {hasDescription && (
          <div style={{ fontSize: "11px", color: "var(--color-neutral-500)", lineHeight: 1.5 }}>
            {description}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, paddingTop: (!isVertical && hasDescription) ? "1px" : 0 }}>
        {control}
      </div>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ipc.getSettings().then(setSettings).catch(console.error);
  }, []);

  // One generic saver keyed by setting name. Only one save runs at a time;
  // failures surface inline instead of a browser-native dialog.
  const saveSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = { ...settings, [key]: value } as AppSettings;
      await ipc.updateSettings(updated);
      setSettings(updated);
    } catch (e) {
      setError(
        "Could not save this setting. " + (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleOsAllowlist = () => {
    if (settings) void saveSetting("os_allowlist_enabled", !settings.os_allowlist_enabled);
  };

  const changeStopChallenge = (e: React.ChangeEvent<HTMLSelectElement>) => {
    void saveSetting("stop_challenge", e.target.value);
  };

  const changeCountdownDuration = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const duration = parseInt(e.target.value, 10);
    if (!Number.isNaN(duration)) void saveSetting("challenge_countdown_duration", duration);
  };

  const toggleCountdownBreathing = () => {
    if (settings) void saveSetting("challenge_countdown_breathing", !settings.challenge_countdown_breathing);
  };

  return (
    <div style={{ padding: "20px 20px", maxWidth: "380px" }}>
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
          {error && (
            <div
              role="alert"
              style={{
                padding: "9px 10px",
                borderRadius: "8px",
                background: "var(--color-pulse-soft)",
                color: "var(--color-pulse)",
                fontSize: "12px",
                lineHeight: 1.35,
              }}
            >
              {error}
            </div>
          )}
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

          <SettingRow
            layout="vertical"
            title={
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                Stop Lockdown Session Method
                <div
                  title="Challenge required to end a lockdown session early."
                  style={{
                    display: "flex",
                    alignItems: "center",
                    color: "var(--color-neutral-400)",
                    cursor: "help",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--color-neutral-600)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--color-neutral-400)")}
                >
                  <Info size={13} weight="bold" />
                </div>
              </div>
            }
            description=""
            control={
              <select
                value={settings.stop_challenge}
                onChange={changeStopChallenge}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-neutral-200)",
                  background: "var(--color-surface)",
                  color: "var(--color-vast)",
                  fontSize: "13px",
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="none">None</option>
                <option value="random">Random Challenge</option>
                <option value="countdown">Countdown Timer</option>
                <option value="typing">Type a Paragraph</option>
                <option value="pattern">Pattern Memory Puzzle</option>
                <option value="math">Mental Challenge (Math/Logic)</option>
                <option value="reflection">Reflection Prompt</option>
              </select>
            }
          />

          {settings.stop_challenge === "countdown" && (
            <div style={{ paddingLeft: "16px", borderLeft: "2px solid var(--color-neutral-200)", display: "flex", flexDirection: "column", gap: "8px", marginLeft: "4px" }}>
              <SettingRow
                title="Timer Duration"
                description="How long to wait before ending the session."
                control={
                  <select
                    value={settings.challenge_countdown_duration}
                    onChange={changeCountdownDuration}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--color-neutral-200)",
                      background: "var(--color-surface)",
                      color: "var(--color-vast)",
                      fontSize: "13px",
                      fontFamily: "var(--font-sans)",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value={15}>15s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                    <option value={120}>2 min</option>
                  </select>
                }
              />
              <SettingRow
                title="Breathing Exercises"
                description="Follow a guided breathing exercise during the countdown."
                control={
                  <Toggle
                    checked={settings.challenge_countdown_breathing}
                    onChange={toggleCountdownBreathing}
                  />
                }
              />
            </div>
          )}

          {/* Extension info */}
          <div
            style={{
              marginTop: "8px",
              padding: "12px 14px",
              background: "var(--color-neutral-50)",
              border: "1px solid var(--color-lumen-dark)",
              borderRadius: "10px",
              fontSize: "11px",
              color: "var(--color-neutral-500)",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "var(--color-neutral-700)" }}>Focus Blocker Extension v0.1.0</strong>
          </div>
        </div>
      )}
    </div>
  );
}

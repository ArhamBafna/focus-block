import { useState, useEffect } from "react";
import { ipc, Preset, SessionMode } from "../lib/ipc";
import { Trash, Plus, X, Clock, Shield } from "@phosphor-icons/react";

type NewPresetForm = {
  name: string;
  mode: SessionMode;
  duration_minutes: number;
};

const EMPTY_FORM: NewPresetForm = { name: "", mode: "blocklist", duration_minutes: 25 };

export default function Presets() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewPresetForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPresets = async () => {
    try {
      setPresets(await ipc.listPresets());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await ipc.createPreset(form.name.trim(), form.mode, form.duration_minutes, [], []);
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchPresets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create preset.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "380px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-vast)", margin: 0, letterSpacing: "-0.3px" }}>
            Presets
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-neutral-500)" }}>
            Saved session configurations you can launch instantly.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            background: "var(--color-vast)",
            color: "var(--color-lumen)",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        >
          <Plus size={13} weight="bold" />
          New Preset
        </button>
      </div>

      {/* New Preset Form */}
      {showForm && (
        <div
          style={{
            marginBottom: "24px",
            padding: "20px",
            background: "var(--color-surface)",
            border: "1.5px solid var(--color-lumen-dark)",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-vast)" }}>New Preset</span>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-neutral-400)", display: "flex", padding: "2px" }}
            >
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-neutral-600)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Deep Work, No Social"
                required
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "14px",
                  fontFamily: "var(--font-sans)",
                  border: "1.5px solid var(--color-lumen-dark)",
                  borderRadius: "8px",
                  background: "var(--color-background)",
                  color: "var(--color-vast)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => ((e.target as HTMLElement).style.borderColor = "var(--color-fathom)")}
                onBlur={(e) => ((e.target as HTMLElement).style.borderColor = "var(--color-lumen-dark)")}
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-neutral-600)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Mode
                </label>
                <select
                  value={form.mode}
                  onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as SessionMode }))}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: "14px",
                    fontFamily: "var(--font-sans)",
                    border: "1.5px solid var(--color-lumen-dark)",
                    borderRadius: "8px",
                    background: "var(--color-background)",
                    color: "var(--color-vast)",
                    outline: "none",
                    boxSizing: "border-box",
                    cursor: "pointer",
                  }}
                >
                  <option value="blocklist">Blocklist</option>
                  <option value="lockdown">Lockdown</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-neutral-600)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={form.duration_minutes}
                  onChange={(e) => setForm((f) => ({ ...f, duration_minutes: parseInt(e.target.value) || 25 }))}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: "14px",
                    fontFamily: "var(--font-sans)",
                    border: "1.5px solid var(--color-lumen-dark)",
                    borderRadius: "8px",
                    background: "var(--color-background)",
                    color: "var(--color-vast)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => ((e.target as HTMLElement).style.borderColor = "var(--color-fathom)")}
                  onBlur={(e) => ((e.target as HTMLElement).style.borderColor = "var(--color-lumen-dark)")}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: 500,
                  fontFamily: "var(--font-sans)",
                  background: "transparent",
                  color: "var(--color-neutral-600)",
                  border: "1.5px solid var(--color-lumen-dark)",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "8px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "var(--font-sans)",
                  background: "var(--color-vast)",
                  color: "var(--color-lumen)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Creating…" : "Create Preset"}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div role="alert" style={{ marginBottom: "12px", padding: "8px 12px", background: "#fff0f0", border: "1px solid #f8d0d0", borderRadius: "8px", fontSize: "12px", color: "var(--color-pulse)" }}>
          {error}
        </div>
      )}

      {/* Preset grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
        {presets.map((p) => (
          <div
            key={p.id}
            style={{
              padding: "12px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-lumen-dark)",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-vast)" }}>{p.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--color-neutral-500)" }}>
                    <Shield size={12} />
                    <span style={{ textTransform: "capitalize" }}>{p.mode}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--color-neutral-500)" }}>
                    <Clock size={12} />
                    {p.duration_minutes}m
                  </span>
                </div>
              </div>
              <button
                onClick={async () => { await ipc.deletePreset(p.id); fetchPresets(); }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  borderRadius: "6px",
                  color: "var(--color-neutral-400)",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#e05c5c")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-neutral-400)")}
              >
                <Trash size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {presets.length === 0 && !showForm && (
          <div style={{ textAlign: "center", padding: "36px 0", color: "var(--color-neutral-400)", fontSize: "13px" }}>
          No presets yet. Create one to quickly launch your favourite session setup.
        </div>
      )}
    </div>
  );
}

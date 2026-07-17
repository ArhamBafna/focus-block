import { useEffect, useState } from "react";
import { ipc, DomainEntry, TemporaryAllowEntry } from "../lib/ipc";
import { Clock, Plus, Trash } from "@phosphor-icons/react";

function remainingTime(expiresAt: number, now: number): string {
  const remainingSeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m ${seconds}s left`;
  return `${seconds}s left`;
}

const inputStyle = (hasError: boolean) => ({
  flex: 1,
  minWidth: 0,
  padding: "8px 12px",
  fontSize: "13px",
  fontFamily: "var(--font-sans)",
  border: hasError ? "1.5px solid #e05c5c" : "1.5px solid var(--color-lumen-dark)",
  borderRadius: "8px",
  background: "var(--color-surface)",
  color: "var(--color-vast)",
  outline: "none",
});

const addButtonStyle = {
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
  whiteSpace: "nowrap" as const,
};

const removeButtonStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "3px",
  borderRadius: "5px",
  color: "var(--color-neutral-400)",
  display: "flex",
  alignItems: "center",
};

export default function Whitelist() {
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [temporaryAllows, setTemporaryAllows] = useState<TemporaryAllowEntry[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [tempDuration, setTempDuration] = useState(15);
  const [showTempModal, setShowTempModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const fetchDomains = async () => {
    try {
      const [permanent, temporary] = await Promise.all([
        ipc.listWhitelist(),
        ipc.listTemporaryAllows(),
      ]);
      setDomains(permanent);
      setTemporaryAllows(temporary);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    void fetchDomains();
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const expired = temporaryAllows.filter((entry) => entry.expires_at <= now);
    if (expired.length === 0) return;
    setTemporaryAllows((entries) => entries.filter((entry) => entry.expires_at > now));
    void Promise.all(expired.map((entry) => ipc.removeTemporaryAllow(entry.id))).catch(console.error);
  }, [now, temporaryAllows]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setError(null);
    try {
      await ipc.addWhitelist(newDomain);
      setNewDomain("");
      await fetchDomains();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleTempAllow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isInteger(tempDuration) || tempDuration <= 0) {
      setError("Enter whole number of minutes.");
      return;
    }
    setError(null);
    try {
      await ipc.addTemporaryAllow(newDomain, tempDuration);
      setNewDomain("");
      setShowTempModal(false);
      await fetchDomains();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "380px" }}>
      <div style={{ marginBottom: "16px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-vast)", margin: 0, letterSpacing: "-0.3px" }}>
          Allowlist
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-neutral-500)" }}>
          Sites always allowed, even in Lockdown mode.
        </p>
        <p style={{ margin: "5px 0 0", fontSize: "11px", color: "var(--color-neutral-400)" }}>
          <strong>*word</strong> applies to all URLs containing <strong>word</strong>.
        </p>
      </div>

      <form onSubmit={handleAdd} style={{ marginBottom: "16px" }}>
        <input
          type="text"
          value={newDomain}
          onChange={(e) => { setNewDomain(e.target.value); setError(null); }}
          placeholder="e.g. github.com or *game"
          aria-label="Site to allow"
          style={{ ...inputStyle(Boolean(error)), width: "100%", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button type="submit" style={{ ...addButtonStyle, flex: 1, justifyContent: "center" }}>
            <Plus size={13} weight="bold" /> Add
          </button>
          <button
            type="button"
            onClick={() => {
              if (!newDomain.trim()) {
                setError("Enter a site first.");
                return;
              }
              setError(null);
              setShowTempModal(true);
            }}
            style={{ ...addButtonStyle, flex: 1, justifyContent: "center" }}
          >
            <Clock size={13} weight="bold" /> Temp Allow
          </button>
        </div>
      </form>

      {error && (
        <div style={{ marginBottom: "12px", padding: "8px 12px", background: "#fff0f0", border: "1px solid #f8d0d0", borderRadius: "8px", fontSize: "12px", color: "var(--color-pulse)" }}>
          {error}
        </div>
      )}

      {showTempModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="temporary-allow-title"
          style={{ position: "fixed", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(0, 0, 0, 0.35)" }}
        >
          <form onSubmit={handleTempAllow} style={{ width: "100%", maxWidth: "300px", padding: "18px", background: "var(--color-surface)", border: "1px solid var(--color-lumen-dark)", borderRadius: "12px", boxShadow: "0 12px 32px rgba(0, 0, 0, 0.2)" }}>
            <h2 id="temporary-allow-title" style={{ margin: 0, fontSize: "15px", color: "var(--color-vast)" }}>Temporary Allow</h2>
            <p style={{ margin: "6px 0 14px", fontSize: "12px", color: "var(--color-neutral-500)", overflowWrap: "anywhere" }}>
              Allow <strong>{newDomain}</strong> for how long?
            </p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--color-surface)", padding: "4px 12px", borderRadius: "100px", border: "1px solid var(--color-neutral-200)" }}>
              <input
                type="number"
                min={1}
                step={1}
                value={tempDuration}
                onChange={(e) => setTempDuration(Number(e.target.value))}
                autoFocus
                aria-label="Temporary allow duration in minutes"
                style={{ width: "50px", border: "none", outline: "none", background: "transparent", fontSize: "16px", fontWeight: 600, color: "var(--color-vast)", textAlign: "center", fontFamily: "var(--font-sans)" }}
              />
              <span style={{ fontSize: "14px", color: "var(--color-vast)", fontWeight: 600 }}>minutes</span>
            </div>
            {error && <div role="alert" style={{ marginTop: "10px", fontSize: "12px", color: "var(--color-pulse)" }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <button type="button" onClick={() => { setShowTempModal(false); setError(null); }} style={{ ...addButtonStyle, background: "#e6e6df", color: "var(--color-vast)" }}>Cancel</button>
              <button type="submit" style={addButtonStyle}>Allow Temporarily</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "300px", overflowY: "auto" }}>
        {domains.length > 0 && (
          <>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "2px" }}>
              Permanent
            </div>
            {domains.map((entry) => (
              <div key={entry.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--color-surface)", border: "1px solid var(--color-lumen-dark)", borderRadius: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-vast)", overflowWrap: "anywhere" }}>{entry.domain}</span>
                <button aria-label={`Remove ${entry.domain}`} onClick={async () => { await ipc.removeWhitelist(entry.id); await fetchDomains(); }} style={removeButtonStyle}>
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </>
        )}

        {temporaryAllows.length > 0 && (
          <>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-neutral-500)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "8px" }}>
              Temporary
            </div>
            {temporaryAllows.map((entry) => (
              <div key={entry.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "10px 12px", background: "#f2faf7", border: "1px solid #cfe8de", borderRadius: "8px" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-vast)", overflowWrap: "anywhere" }}>{entry.domain}</span>
                    <span style={{ padding: "2px 5px", borderRadius: "4px", background: "#d9f0e7", color: "#216650", fontSize: "9px", fontWeight: 700, letterSpacing: "0.3px" }}>TEMPORARY</span>
                  </div>
                  <div aria-live="polite" style={{ marginTop: "3px", fontSize: "11px", color: "#397760" }}>{remainingTime(entry.expires_at, now)}</div>
                </div>
                <button aria-label={`Remove temporary allow for ${entry.domain}`} onClick={async () => { await ipc.removeTemporaryAllow(entry.id); await fetchDomains(); }} style={removeButtonStyle}>
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

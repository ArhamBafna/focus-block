import { useState, useEffect } from "react";
import { ipc, Session } from "../lib/ipc";
import { ClockCounterClockwise } from "@phosphor-icons/react";

function formatDuration(sec: number) {
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;
}

function statusColor(status: string) {
  if (status === "completed") return "#027a48";
  if (status === "active") return "var(--color-fathom)";
  return "var(--color-neutral-500)";
}

function statusBg(status: string) {
  if (status === "completed") return "#ecfdf3";
  if (status === "active") return "#e6f5f3";
  return "var(--color-neutral-50)";
}

export default function History() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    ipc.listHistory(20).then(setSessions).catch(console.error);
  }, []);

  async function handleClearHistory() {
    setIsClearing(true);
    try {
      await ipc.clearHistory();
      setSessions([]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div style={{ padding: "20px 20px", maxWidth: "380px" }}>
      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <h1
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--color-vast)",
              margin: 0,
              letterSpacing: "-0.3px",
            }}
          >
            History
          </h1>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            onMouseEnter={(event) => {
              if (!event.currentTarget.disabled) {
                event.currentTarget.style.background = "var(--color-pulse-soft)";
                event.currentTarget.style.color = "var(--color-pulse)";
                event.currentTarget.style.borderColor = "var(--color-pulse)";
              }
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
              event.currentTarget.style.color = sessions.length === 0 ? "var(--color-text-disabled)" : "var(--color-pulse)";
              event.currentTarget.style.borderColor = sessions.length === 0 ? "var(--color-lumen-dark)" : "var(--color-pulse)";
            }}
            disabled={isClearing || sessions.length === 0}
            style={{
              border: "1px solid var(--color-pulse)",
              background: "transparent",
              color: sessions.length === 0 ? "var(--color-text-disabled)" : "var(--color-pulse)",
              borderRadius: "7px",
              padding: "5px 9px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: sessions.length === 0 ? "not-allowed" : "pointer",
              transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
            }}
          >
            {isClearing ? "Clearing..." : "Clear"}
          </button>
        </div>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-neutral-500)" }}>
          Your past focus sessions.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "420px", overflowY: "auto" }}>
        {sessions.map((s) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-lumen-dark)",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "7px",
                  background: statusBg(s.status),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ClockCounterClockwise size={14} color={statusColor(s.status)} />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-vast)", textTransform: "capitalize" }}>
                  {s.mode} Session
                </div>
                <div style={{ fontSize: "11px", color: "var(--color-neutral-500)", marginTop: "2px" }}>
                  {new Date(s.started_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: "100px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: statusColor(s.status),
                  background: statusBg(s.status),
                  textTransform: "capitalize",
                  marginBottom: "3px",
                }}
              >
                {s.status}
              </span>
              <div style={{ fontSize: "11px", color: "var(--color-neutral-400)" }}>
                {formatDuration(s.planned_duration_sec)} planned
              </div>
            </div>
          </div>
        ))}

        {sessions.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "var(--color-neutral-400)",
              fontSize: "13px",
            }}
          >
            No sessions yet. Start your first focus session.
          </div>
        )}
      </div>

      {showClearConfirm && (
        <div className="confirm-backdrop" role="presentation" onClick={() => setShowClearConfirm(false)} style={{ position: "fixed", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(26, 26, 26, 0.32)" }}>
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-history-title" onClick={(event) => event.stopPropagation()} style={{ width: "min(100%, 320px)", padding: "20px", background: "var(--color-lumen)", border: "none", borderRadius: "12px", boxShadow: "0 18px 50px rgba(26, 26, 26, 0.18)" }}>
            <h2 id="clear-history-title" style={{ margin: 0, color: "var(--color-vast)", fontSize: "16px" }}>Clear session history?</h2>
            <p style={{ margin: "8px 0 18px", color: "var(--color-neutral-500)", fontSize: "12px", lineHeight: 1.5 }}>This deletes all saved past sessions. Active session stays safe.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "7px" }}>
              <button type="button" onClick={() => setShowClearConfirm(false)} style={{ border: "1px solid var(--color-lumen-dark)", background: "transparent", color: "var(--color-vast)", borderRadius: "7px", padding: "7px 11px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button type="button" onClick={() => { setShowClearConfirm(false); void handleClearHistory(); }} style={{ border: "1px solid var(--color-pulse)", background: "var(--color-pulse)", color: "#ffffff", borderRadius: "7px", padding: "7px 11px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Clear history</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

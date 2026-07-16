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
    <div style={{ padding: "32px 40px", maxWidth: "720px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--color-vast)",
            margin: 0,
            letterSpacing: "-0.4px",
          }}
          >
            History
          </h1>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            onMouseEnter={(event) => {
              if (!event.currentTarget.disabled) {
                event.currentTarget.style.background = "#f8e4e4";
                event.currentTarget.style.color = "#7f1c34";
                event.currentTarget.style.borderColor = "#7f1c34";
              }
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
              event.currentTarget.style.color = sessions.length === 0 ? "var(--color-neutral-300)" : "#7f1c34";
              event.currentTarget.style.borderColor = sessions.length === 0 ? "var(--color-lumen-dark)" : "#7f1c34";
            }}
            disabled={isClearing || sessions.length === 0}
            style={{
              border: "1px solid #7f1c34",
              background: "transparent",
              color: sessions.length === 0 ? "var(--color-neutral-300)" : "#7f1c34",
              borderRadius: "8px",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: sessions.length === 0 ? "not-allowed" : "pointer",
              transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
            }}
          >
            {isClearing ? "Clearing…" : "Clear"}
          </button>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--color-neutral-500)" }}>
          Your past focus sessions.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {sessions.map((s) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-lumen-dark)",
              borderRadius: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: statusBg(s.status),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ClockCounterClockwise size={16} color={statusColor(s.status)} />
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-vast)", textTransform: "capitalize" }}>
                  {s.mode} Session
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-neutral-500)", marginTop: "2px" }}>
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
                  padding: "3px 10px",
                  borderRadius: "100px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: statusColor(s.status),
                  background: statusBg(s.status),
                  textTransform: "capitalize",
                  marginBottom: "4px",
                }}
              >
                {s.status}
              </span>
              <div style={{ fontSize: "12px", color: "var(--color-neutral-400)" }}>
                {formatDuration(s.planned_duration_sec)} planned
              </div>
            </div>
          </div>
        ))}

        {sessions.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "56px 0",
              color: "var(--color-neutral-400)",
              fontSize: "14px",
            }}
          >
            No sessions yet. Start your first focus session.
          </div>
        )}
      </div>

      {showClearConfirm && (
        <div role="presentation" onClick={() => setShowClearConfirm(false)} style={{ position: "fixed", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "rgba(26, 26, 26, 0.32)" }}>
          <div role="dialog" aria-modal="true" aria-labelledby="clear-history-title" onClick={(event) => event.stopPropagation()} style={{ width: "min(100%, 380px)", padding: "24px", background: "var(--color-lumen)", border: "1px solid var(--color-lumen-dark)", borderRadius: "14px", boxShadow: "0 18px 50px rgba(26, 26, 26, 0.18)" }}>
            <h2 id="clear-history-title" style={{ margin: 0, color: "var(--color-vast)", fontSize: "18px" }}>Clear session history?</h2>
            <p style={{ margin: "8px 0 20px", color: "var(--color-neutral-500)", fontSize: "14px", lineHeight: 1.5 }}>This deletes all saved past sessions. Active session stays safe.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" onClick={() => setShowClearConfirm(false)} style={{ border: "1px solid var(--color-lumen-dark)", background: "transparent", color: "var(--color-vast)", borderRadius: "8px", padding: "9px 14px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button type="button" onClick={() => { setShowClearConfirm(false); void handleClearHistory(); }} style={{ border: "1px solid #7f1c34", background: "#7f1c34", color: "#ffffff", borderRadius: "8px", padding: "9px 14px", fontWeight: 600, cursor: "pointer" }}>Clear history</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

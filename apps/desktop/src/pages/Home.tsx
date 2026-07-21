import { useEffect, useState } from "react";
import { ipc, ServiceStatus } from "../lib/ipc";
import { Play, Stop, ShieldCheck } from "@phosphor-icons/react";

function formatTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function Home() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionInputMode, setSessionInputMode] = useState<"blocklist" | "lockdown" | null>(null);
  const [minutesStr, setMinutesStr] = useState("25");
  const [hoveredSessionMode, setHoveredSessionMode] = useState<"blocklist" | "lockdown" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setStatus(await ipc.getStatus());
    } catch (fetchError) {
      console.error(fetchError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
    const interval = window.setInterval(() => void fetchStatus(), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const startConfiguredSession = async () => {
    if (!sessionInputMode) return;
    const minutes = Number.parseInt(minutesStr, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError("Enter a whole number of minutes above zero.");
      return;
    }

    setError(null);
    try {
      await ipc.startSession(sessionInputMode, minutes);
      setSessionInputMode(null);
      await fetchStatus();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start session.");
    }
  };

  const stopSession = async () => {
    setError(null);
    try {
      await ipc.stopSession();
      await fetchStatus();
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Could not stop session.");
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "440px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-neutral-400)",
          fontSize: "14px",
        }}
      >
        Loading…
      </div>
    );
  }

  const active = status?.active_session;

  return (
    <div
      style={{
        minHeight: "440px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 32px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "50%",
          background: active ? "var(--color-fathom)" : "var(--color-lumen-dark)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
          transition: "background 0.3s ease",
        }}
      >
        <ShieldCheck
          size={32}
          weight="fill"
          color={active ? "var(--color-lumen)" : "var(--color-neutral-400)"}
        />
      </div>

      <h1
        style={{
          fontSize: "22px",
          fontWeight: 700,
          letterSpacing: "-0.5px",
          color: "var(--color-vast)",
          margin: "0 0 6px",
        }}
      >
        {active ? (
          active.session.mode === "lockdown" ? (
            <span>
              <span style={{ color: "var(--color-pulse)" }}>Lockdown</span> Mode Active
            </span>
          ) : (
            "Focus Mode Active"
          )
        ) : (
          "ready to focus?"
        )}
      </h1>

      {active ? (
        <>
          <div
            style={{
              fontSize: "52px",
              fontWeight: 700,
              letterSpacing: "-2px",
              fontVariantNumeric: "tabular-nums",
              color: "var(--color-fathom)",
              margin: "10px 0 20px",
              fontFamily: "var(--font-sans)",
            }}
          >
            {active.remaining_sec !== null ? formatTime(active.remaining_sec) : "∞"}
          </div>
          <div style={{ fontSize: "13px", color: "var(--color-neutral-500)", marginBottom: "24px" }}>
            {active.session.blocklist_snapshot.length} site
            {active.session.blocklist_snapshot.length !== 1 ? "s" : ""} blocked
          </div>
          <button
            type="button"
            onClick={stopSession}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "11px 28px",
              fontSize: "15px",
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              background: "var(--color-vast)",
              color: "var(--color-lumen)",
              border: "none",
              borderRadius: "100px",
              cursor: "pointer",
              transition: "opacity 0.15s",
              boxShadow: "0 2px 12px rgba(26,26,26,0.15)",
            }}
            onMouseEnter={(event) => { event.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={(event) => { event.currentTarget.style.opacity = "1"; }}
          >
            <Stop weight="fill" size={17} />
            Stop Session
          </button>
        </>
      ) : sessionInputMode ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--color-surface)",
              padding: "4px 12px",
              borderRadius: "100px",
              border: "1px solid var(--color-neutral-200)",
            }}
          >
            <input
              type="number"
              min={1}
              value={minutesStr}
              onChange={(event) => { setMinutesStr(event.target.value); setError(null); }}
              style={{
                width: "50px",
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--color-vast)",
                textAlign: "center",
                fontFamily: "var(--font-sans)",
              }}
              autoFocus
            />
            <span style={{ fontSize: "14px", color: "var(--color-vast)", fontWeight: 600 }}>minutes</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => { setSessionInputMode(null); setError(null); }}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
                background: "transparent",
                color: "var(--color-neutral-500)",
                border: "none",
                borderRadius: "100px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={startConfiguredSession}
              style={{
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
                background: sessionInputMode === "lockdown" ? "var(--color-pulse)" : "var(--color-fathom)",
                color: "var(--color-lumen)",
                border: "none",
                borderRadius: "100px",
                cursor: "pointer",
                boxShadow: sessionInputMode === "lockdown"
                  ? "0 4px 12px rgba(127, 28, 52, 0.25)"
                  : "0 4px 12px rgba(3,79,70,0.25)",
              }}
            >
              Start
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => setSessionInputMode("blocklist")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "13px 24px",
                fontSize: "15px",
                fontWeight: 700,
                fontFamily: "var(--font-sans)",
                background: "var(--color-fathom)",
                color: "var(--color-lumen)",
                border: "none",
                borderRadius: "100px",
                cursor: "pointer",
                transition: "opacity 0.15s, transform 0.15s",
                boxShadow: "0 4px 20px rgba(3,79,70,0.3)",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.opacity = "0.9";
                event.currentTarget.style.transform = "translateY(-1px)";
                setHoveredSessionMode("blocklist");
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.opacity = "1";
                event.currentTarget.style.transform = "translateY(0)";
                setHoveredSessionMode(null);
              }}
            >
              <Play weight="fill" size={17} />
              focus
            </button>
            <button
              type="button"
              onClick={() => setSessionInputMode("lockdown")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "13px 24px",
                fontSize: "15px",
                fontWeight: 700,
                fontFamily: "var(--font-sans)",
                background: "var(--color-pulse)",
                color: "var(--color-lumen)",
                border: "none",
                borderRadius: "100px",
                cursor: "pointer",
                transition: "opacity 0.15s, transform 0.15s",
                boxShadow: "0 4px 20px rgba(127, 28, 52, 0.3)",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.opacity = "0.9";
                event.currentTarget.style.transform = "translateY(-1px)";
                setHoveredSessionMode("lockdown");
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.opacity = "1";
                event.currentTarget.style.transform = "translateY(0)";
                setHoveredSessionMode(null);
              }}
            >
              <ShieldCheck weight="fill" size={17} />
              lockdown
            </button>
          </div>
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-neutral-500)",
              margin: "16px 0 0",
              width: "100%",
              maxWidth: "320px",
              whiteSpace: "nowrap",
            }}
          >
            {hoveredSessionMode === "blocklist"
              ? "block sites in blocked list for a set time"
              : hoveredSessionMode === "lockdown"
                ? "block all sites except those in allow list for a set time"
                : "hover over button for details"}
          </p>
        </>
      )}

      {error && (
        <div role="alert" style={{ marginTop: "16px", color: "var(--color-pulse)", fontSize: "12px" }}>
          {error}
        </div>
      )}
    </div>
  );
}

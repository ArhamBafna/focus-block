import { useEffect, useState } from "react";
import { ipc, ServiceStatus } from "../lib/ipc";
import { Play, Stop, ShieldCheck } from "@phosphor-icons/react";

function formatTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** One honest status for the page; no phase fakes readiness. */
type HomePhase = "loading" | "unreachable" | "ready";

const warningBannerStyle: React.CSSProperties = {
  marginBottom: "24px",
  padding: "12px 20px",
  background: "#fff8e0",
  border: "1px solid #f0d070",
  borderRadius: "10px",
  fontSize: "13px",
  color: "#7a5c00",
  maxWidth: "480px",
  width: "100%",
};

export default function Home() {
  // Last-known-good status. Kept during transient failures so an active
  // session keeps rendering instead of snapping to a fake idle state.
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [phase, setPhase] = useState<HomePhase>("loading");
  const [degraded, setDegraded] = useState(false);
  const [durationInput, setDurationInput] = useState("25");
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchStatus = async () => {
    const envelope = await ipc.getStatusSafe();
    if (envelope.ok) {
      setStatus(envelope.data);
      setDegraded(false);
      setPhase("ready");
      return;
    }
    if (envelope.kind === "unavailable") {
      if (status?.active_session) {
        // Mid-session transport loss: keep the session view, warn quietly.
        setDegraded(true);
        setPhase("ready");
      } else {
        setPhase("unreachable");
      }
      return;
    }
    // Application error: data channel works, but this poll failed.
    console.error("[service]", envelope.message);
    if (!status) setPhase("unreachable");
    else setDegraded(true);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartSession = async (mode: "blocklist" | "lockdown") => {
    const time = parseInt(durationInput, 10);
    if (isNaN(time) || time <= 0) {
      setActionError("Enter a valid number of minutes.");
      return;
    }
    setActionError(null);
    try {
      await ipc.startSession(mode, time);
      fetchStatus();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  const stopSession = async () => {
    setActionError(null);
    try {
      await ipc.stopSession();
      fetchStatus();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  if (phase === "loading") {
    return (
      <div
        style={{
          height: "100%",
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

  if (phase === "unreachable") {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px",
          textAlign: "center",
          gap: "20px",
        }}
      >
        <div style={{ ...warningBannerStyle, marginBottom: 0 }}>
          ⚠ FocusBlock service is not running. Start it to enable blocking.
        </div>
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "var(--color-lumen-dark)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.6,
          }}
        >
          <ShieldCheck size={36} weight="fill" color="var(--color-neutral-400)" />
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-vast)", margin: 0 }}>
          Service Unreachable
        </h1>
        <p style={{ fontSize: "14px", color: "var(--color-neutral-500)", margin: 0, maxWidth: "320px" }}>
          Sessions cannot be started or stopped until the FocusBlock service is back. This page
          reconnects automatically.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        textAlign: "center",
      }}
    >
      {/* Transient failure while showing last-known-good data */}
      {degraded && (
        <div style={warningBannerStyle}>
          ⚠ Connection to the service was lost. Showing the last known state — retrying.
        </div>
      )}

      {/* Status icon */}
      <div
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: active ? "var(--color-fathom)" : "var(--color-lumen-dark)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
          transition: "background 0.3s ease",
        }}
      >
        <ShieldCheck
          size={36}
          weight="fill"
          color={active ? "var(--color-lumen)" : "var(--color-neutral-400)"}
        />
      </div>

      {/* Main heading */}
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 700,
          letterSpacing: "-0.6px",
          color: "var(--color-vast)",
          margin: "0 0 8px",
        }}
      >
        {active ? (
          active.session.mode === "lockdown" ? (
            <span>
              <span style={{ color: "#d93025" }}>Lockdown</span> Mode Active
            </span>
          ) : (
            "Focus Mode Active"
          )
        ) : (
          "Ready to Focus"
        )}
      </h1>

      {/* Timer or subtitle */}
      {active ? (
        <>
          <div
            style={{
              fontSize: "56px",
              fontWeight: 700,
              letterSpacing: "-2px",
              fontVariantNumeric: "tabular-nums",
              color: "var(--color-fathom)",
              margin: "12px 0 28px",
              fontFamily: "var(--font-sans)",
            }}
          >
            {active.remaining_sec !== null ? formatTime(active.remaining_sec) : "∞"}
          </div>

          <div
            style={{
              fontSize: "13px",
              color: "var(--color-neutral-500)",
              marginBottom: "28px",
            }}
          >
            {active.session.blocklist_snapshot.length} site
            {active.session.blocklist_snapshot.length !== 1 ? "s" : ""} blocked
          </div>

          <button
            onClick={stopSession}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 28px",
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
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            <Stop weight="fill" size={18} />
            Stop Session
          </button>
        </>
      ) : (
        <>
          <p
            style={{
              fontSize: "15px",
              color: "var(--color-neutral-500)",
              margin: "0 0 20px",
              maxWidth: "300px",
            }}
          >
            Start a focus session to block distracting sites.
          </p>

          {/* Inline duration picker (no native dialogs) */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "var(--color-neutral-500)",
              marginBottom: actionError ? "10px" : "20px",
            }}
          >
            Duration
            <input
              type="text"
              inputMode="numeric"
              value={durationInput}
              onChange={(e) => {
                setDurationInput(e.target.value);
                setActionError(null);
              }}
              aria-label="Session duration in minutes"
              style={{
                width: "64px",
                padding: "8px 12px",
                fontSize: "14px",
                fontFamily: "var(--font-sans)",
                border: actionError ? "1.5px solid #e05c5c" : "1.5px solid var(--color-lumen-dark)",
                borderRadius: "8px",
                background: "var(--color-surface)",
                color: "var(--color-vast)",
                outline: "none",
                transition: "border-color 0.15s",
                textAlign: "center",
              }}
            />
            minutes
          </label>

          {actionError && (
            <div role="alert" style={{ marginBottom: "14px", fontSize: "12px", color: "#b02020" }}>
              {actionError}
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              onClick={() => handleStartSession("blocklist")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 36px",
                fontSize: "16px",
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
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "0.9";
                (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "1";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              }}
            >
              <Play weight="fill" size={18} />
              Focus
            </button>

            <button
              onClick={() => handleStartSession("lockdown")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 36px",
                fontSize: "16px",
                fontWeight: 700,
                fontFamily: "var(--font-sans)",
                background: "#d93025",
                color: "var(--color-lumen)",
                border: "none",
                borderRadius: "100px",
                cursor: "pointer",
                transition: "opacity 0.15s, transform 0.15s",
                boxShadow: "0 4px 20px rgba(217, 48, 37, 0.3)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "0.9";
                (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "1";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              }}
            >
              <ShieldCheck weight="fill" size={18} />
              Locked Down
            </button>
          </div>
        </>
      )}
    </div>
  );
}

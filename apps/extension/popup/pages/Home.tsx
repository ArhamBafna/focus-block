import { useEffect, useRef, useState } from "react";
import { ipc, ServiceStatus, AppSettings } from "../lib/ipc";
import { Play, Stop, ShieldCheck, Warning } from "@phosphor-icons/react";
import { ChallengeGate } from "../components/ChallengeGate";

function formatTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** One honest status for the page; no phase fakes readiness (issue #21). */
type HomePhase = "loading" | "unreachable" | "ready";

const warningBannerStyle: React.CSSProperties = {
  marginBottom: "16px",
  padding: "10px 14px",
  background: "#fff8e0",
  border: "1px solid #f0d070",
  borderRadius: "10px",
  fontSize: "12px",
  color: "#7a5c00",
  width: "100%",
};

export default function Home() {
  // Last-known-good status. Kept during transient failures so an active
  // session keeps rendering instead of snapping to a fake idle state.
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  // The mount effect runs once, so its closures read the latest status
  // through a ref instead of the render-scoped state variable.
  const statusRef = useRef<ServiceStatus | null>(null);
  const recordStatus = (next: ServiceStatus | null) => {
    statusRef.current = next;
    setStatus(next);
  };
  const [phase, setPhase] = useState<HomePhase>("loading");
  const [degraded, setDegraded] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [sessionInputMode, setSessionInputMode] = useState<"blocklist" | "lockdown" | null>(null);
  const [minutesStr, setMinutesStr] = useState("25");
  const [hoveredSessionMode, setHoveredSessionMode] = useState<"blocklist" | "lockdown" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Display-only clock: re-renders the countdown locally without sending any
  // message to the service worker.
  const [, setTick] = useState(0);

  const fetchStatus = async () => {
    const envelope = await ipc.getStatusSafe();
    if (envelope.ok) {
      recordStatus(envelope.data);
      setDegraded(false);
      setPhase("ready");
      return;
    }
    if (envelope.kind === "unavailable") {
      if (statusRef.current?.active_session) {
        // Mid-session transport loss: keep the session view, warn quietly.
        setDegraded(true);
        setPhase("ready");
      } else {
        setPhase("unreachable");
      }
      return;
    }
    // Application error: data channel works, but this probe failed.
    console.error("[FocusBlocker popup]", envelope.message);
    if (!statusRef.current) setPhase("unreachable");
    else setDegraded(true);
  };

  useEffect(() => {
    void fetchStatus();
    void ipc.getSettings().then(setSettings).catch(console.error);

    // Event-driven refresh: the service worker's storage writes are the source
    // of truth. No per-second getStatus/expire messages while the popup is open.
    const onStorageChanged = (
      changes: Record<string, unknown>,
      area: chrome.storage.AreaName
    ) => {
      if (area !== "local") return;
      if ("active_session" in changes || "active_challenge" in changes) {
        void fetchStatus();
      }
    };
    chrome.storage.onChanged.addListener(onStorageChanged);

    const displayClock = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      clearInterval(displayClock);
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startConfiguredSession = async () => {
    if (!sessionInputMode) return;
    const minutes = Number.parseInt(minutesStr, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setActionError("Enter a valid number of minutes.");
      return;
    }

    setActionError(null);
    try {
      await ipc.startSession(sessionInputMode, minutes);
      setSessionInputMode(null);
      void fetchStatus();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const stopSession = async () => {
    if (settings && settings.stop_challenge !== "none") {
      try {
        let challengeToStart = settings.stop_challenge;
        if (challengeToStart === "random") {
          const challenges = ["countdown", "typing", "pattern", "math", "reflection"];
          challengeToStart = challenges[Math.floor(Math.random() * challenges.length)];
        }
        await ipc.startChallenge(challengeToStart);
        void fetchStatus();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    setActionError(null);
    try {
      await ipc.stopSession();
      void fetchStatus();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  if (phase === "loading") {
    return (
      <div
        style={{
          height: "440px",
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

  if (phase === "unreachable") {
    return (
      <div
        style={{
          height: "440px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 32px",
          textAlign: "center",
          gap: "18px",
        }}
      >
        <Warning size={40} weight="fill" color="#b98a00" />
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-vast)", margin: 0 }}>
          Background Unavailable
        </h1>
        <p style={{ fontSize: "13px", color: "var(--color-neutral-500)", margin: 0, maxWidth: "300px" }}>
          The Focus Blocker background service is not responding. Sessions cannot be started or
          stopped until it recovers.
        </p>
        <button
          onClick={() => { setPhase("loading"); void fetchStatus(); }}
          style={{
            padding: "10px 26px",
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            background: "var(--color-vast)",
            color: "var(--color-lumen)",
            border: "none",
            borderRadius: "100px",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const active = status?.active_session;
  const challenge = status?.active_challenge;

  // Live countdown computed from the session start time; no service-worker round trip.
  let remainingSec: number | null = null;
  if (active) {
    const elapsed = Math.floor((Date.now() - new Date(active.session.started_at).getTime()) / 1000);
    remainingSec = Math.max(0, active.session.planned_duration_sec - elapsed);
  }

  if (challenge && challenge.status === "pending" && settings) {
    return (
      <ChallengeGate
        challengeType={challenge.type}
        settings={settings}
        onSuccess={async () => {
          await ipc.stopSession().catch((error: unknown) => {
            setActionError(error instanceof Error ? error.message : String(error));
          });
          void fetchStatus();
        }}
        onCancel={async () => {
          await ipc.cancelChallenge().catch((error: unknown) => {
            setActionError(error instanceof Error ? error.message : String(error));
          });
          void fetchStatus();
        }}
      />
    );
  }

  return (
    <div
      style={{
        height: "440px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 32px",
        textAlign: "center",
      }}
    >
      {/* Transient failure while showing last-known-good data */}
      {degraded && (
        <div style={warningBannerStyle}>
          ⚠ Lost contact with the background service. Showing the last known state — retrying.
        </div>
      )}

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

      {actionError && !active && (
        <div role="alert" style={{ marginBottom: "8px", fontSize: "12px", color: "#b02020" }}>
          {actionError}
        </div>
      )}

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
            {remainingSec !== null ? formatTime(remainingSec) : "∞"}
          </div>
          <div style={{ fontSize: "13px", color: "var(--color-neutral-500)", marginBottom: "24px" }}>
            {active.session.blocklist_snapshot.length} site
            {active.session.blocklist_snapshot.length !== 1 ? "s" : ""} blocked
          </div>

          {actionError && (
            <div role="alert" style={{ marginBottom: "12px", fontSize: "12px", color: "#b02020" }}>
              {actionError}
            </div>
          )}

          <button
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
            onMouseEnter={(event) => ((event.currentTarget as HTMLElement).style.opacity = "0.85")}
            onMouseLeave={(event) => ((event.currentTarget as HTMLElement).style.opacity = "1")}
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
              value={minutesStr}
              onChange={(event) => { setMinutesStr(event.target.value); setActionError(null); }}
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

          {actionError && (
            <div role="alert" style={{ fontSize: "12px", color: "#b02020" }}>
              {actionError}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => { setSessionInputMode(null); setActionError(null); }}
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
                boxShadow:
                  sessionInputMode === "lockdown"
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
    </div>
  );
}

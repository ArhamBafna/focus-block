import { useState, useEffect, useCallback, useRef } from "react";
import { HashRouter as Router, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { Timer } from "@phosphor-icons/react/Timer";
import { Shield } from "@phosphor-icons/react/Shield";
import { ListPlus } from "@phosphor-icons/react/ListPlus";
import { ClockCounterClockwise } from "@phosphor-icons/react/ClockCounterClockwise";
import { Gear } from "@phosphor-icons/react/Gear";
import { ListChecks } from "@phosphor-icons/react/ListChecks";
import { CalendarDots } from "@phosphor-icons/react/CalendarDots";
import Home from "./pages/Home";
import Blocklists from "./pages/Blocklists";
import Whitelist from "./pages/Whitelist";
import Schedule from "./pages/Schedule";
import Presets from "./pages/Presets";
import History from "./pages/History";
import Settings from "./pages/Settings";
import { AppBlockedModal } from "./components/AppBlockedModal";
import { ipc, BlockedAppEvent } from "./lib/ipc";
import "./App.css";

const navItems = [
  { path: "/", label: "Focus", icon: <Timer size={18} /> },
  { path: "/blocklists", label: "Block", icon: <Shield size={18} /> },
  { path: "/whitelist", label: "Allow", icon: <ListChecks size={18} /> },
  { path: "/schedule", label: "Schedule", icon: <CalendarDots size={18} /> },
  { path: "/presets", label: "Presets", icon: <ListPlus size={18} /> },
  { path: "/history", label: "History", icon: <ClockCounterClockwise size={18} /> },
  { path: "/settings", label: "Settings", icon: <Gear size={18} /> },
];

function Topbar() {
  const location = useLocation();
  return (
    <div
      style={{
        background: "var(--color-vast)",
        display: "flex",
        alignItems: "stretch",
        padding: "0 8px",
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "10px 10px 10px 4px",
          borderRight: "1px solid rgba(255,255,235,0.1)",
          marginRight: "4px",
        }}
      >
        <div
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "6px",
            background: "var(--color-dawn)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Shield size={13} weight="fill" color="var(--color-vast)" />
        </div>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: "13px",
            color: "var(--color-lumen)",
            letterSpacing: "-0.2px",
            whiteSpace: "nowrap",
          }}
        >
          Focus Blocker
        </span>
      </div>

      <nav
        className="top-nav"
        style={{ display: "flex", flex: 1, minWidth: 0, alignItems: "stretch", gap: "2px", padding: "6px 0" }}
      >
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              className={`top-nav-item${isActive ? " is-active" : ""}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "2px",
                padding: "4px 8px",
                borderRadius: "8px",
                fontSize: "10px",
                fontWeight: isActive ? 600 : 400,
                textDecoration: "none",
                minWidth: item.label === "Settings" ? "58px" : "50px",
              }}
            >
              {item.icon}
              <span style={{ fontSize: "9px", letterSpacing: "0.2px" }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const [blockedEvent, setBlockedEvent] = useState<BlockedAppEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dismissedTimestampRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        const envelope = await ipc.getStatusSafe();
        if (envelope.ok && envelope.data.last_blocked_app && isMounted) {
          const next = envelope.data.last_blocked_app;
          if (dismissedTimestampRef.current !== next.timestamp) {
            setBlockedEvent(next);
            setIsModalOpen(true);
          }
        }
      } catch {
        // Quiet poll error
      }
    };

    // Perform initial check immediately
    checkStatus();

    const unsub = ipc.subscribeStatus?.((status) => {
      if (status.last_blocked_app && isMounted) {
        const next = status.last_blocked_app;
        if (dismissedTimestampRef.current !== next.timestamp) {
          setBlockedEvent(next);
          setIsModalOpen(true);
        }
      }
    });

    // When away from the Home page (which polls continuously every 1s),
    // keep a gentle 2.5s poll active so blocked app interception is still detected.
    let interval: any = null;
    if (location.pathname !== "/") {
      interval = setInterval(checkStatus, 2500);
    }

    return () => {
      isMounted = false;
      unsub?.();
      if (interval) clearInterval(interval);
    };
  }, [location.pathname]);

  const handleDismiss = useCallback(() => {
    if (blockedEvent?.timestamp) {
      dismissedTimestampRef.current = blockedEvent.timestamp;
    }
    setIsModalOpen(false);
    setBlockedEvent(null);
    try {
      ipc.clearLastBlockedApp?.()?.catch?.(() => {});
    } catch {
      // ignore
    }
  }, [blockedEvent]);

  const handleBackToFocus = useCallback(() => {
    if (blockedEvent?.timestamp) {
      dismissedTimestampRef.current = blockedEvent.timestamp;
    }
    setIsModalOpen(false);
    setBlockedEvent(null);
    try {
      ipc.clearLastBlockedApp?.()?.catch?.(() => {});
    } catch {
      // ignore
    }
    navigate("/");
  }, [blockedEvent, navigate]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        overflow: "hidden",
        background: "var(--color-background)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <Topbar />
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          background: "var(--color-background)",
          color: "var(--color-foreground)",
          minWidth: 0,
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/blocklists" element={<Blocklists />} />
          <Route path="/whitelist" element={<Whitelist />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/presets" element={<Presets />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <AppBlockedModal
        event={blockedEvent}
        isOpen={isModalOpen}
        onDismiss={handleDismiss}
        onBackToFocus={handleBackToFocus}
      />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

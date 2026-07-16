import { HashRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { Timer, Shield, ListPlus, ClockCounterClockwise, Gear, ListChecks } from "@phosphor-icons/react";
import Home from "./pages/Home";
import Blocklists from "./pages/Blocklists";
import Whitelist from "./pages/Whitelist";
import Presets from "./pages/Presets";
import History from "./pages/History";
import Settings from "./pages/Settings";
import "./App.css";

function Sidebar() {
  const location = useLocation();
  const navItems = [
    { path: "/", label: "Focus", icon: <Timer size={20} /> },
    { path: "/blocklists", label: "Blocklists", icon: <Shield size={20} /> },
    { path: "/whitelist", label: "Whitelist", icon: <ListChecks size={20} /> },
    { path: "/presets", label: "Presets", icon: <ListPlus size={20} /> },
    { path: "/history", label: "History", icon: <ClockCounterClockwise size={20} /> },
    { path: "/settings", label: "Settings", icon: <Gear size={20} /> },
  ];

  return (
    <div
      style={{
        width: "220px",
        minWidth: "220px",
        height: "100vh",
        background: "var(--color-vast)",
        display: "flex",
        flexDirection: "column",
        paddingTop: "24px",
        paddingBottom: "16px",
        flexShrink: 0,
      }}
    >
      {/* Logo / Brand */}
      <div
        style={{
          padding: "0 20px",
          marginBottom: "32px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            background: "var(--color-dawn)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Shield size={16} weight="fill" color="var(--color-vast)" />
        </div>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: "15px",
            color: "var(--color-lumen)",
            letterSpacing: "-0.3px",
          }}
        >
          Focus Blocker
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: "2px" }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 12px",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--color-vast)" : "var(--color-lumen)",
                background: isActive ? "var(--color-dawn)" : "transparent",
                transition: "all 0.15s ease",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,235,0.07)";
                  (e.currentTarget as HTMLElement).style.color = "var(--color-lumen)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,235,0.6)";
                }
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer hint */}
      <div
        style={{
          padding: "12px 20px 0",
          borderTop: "1px solid rgba(255,255,235,0.08)",
          marginTop: "8px",
        }}
      >
        <span style={{ fontSize: "12px", color: "rgba(255,255,235,0.3)", fontWeight: 400 }}>
          v0.1.0
        </span>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: "var(--color-background)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <Sidebar />
        <main
          style={{
            flex: 1,
            height: "100%",
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
            <Route path="/presets" element={<Presets />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

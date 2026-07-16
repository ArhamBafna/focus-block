import { HashRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { Timer, Shield, ClockCounterClockwise, Gear, ListChecks, CalendarDots } from "@phosphor-icons/react";
import Home from "./pages/Home";
import Blocklists from "./pages/Blocklists";
import Whitelist from "./pages/Whitelist";
import History from "./pages/History";
import Schedule from "./pages/Schedule";
import Settings from "./pages/Settings";
import "./App.css";

const navItems = [
  { path: "/", label: "Focus", icon: <Timer size={18} /> },
  { path: "/blocklists", label: "Block", icon: <Shield size={18} /> },
  { path: "/whitelist", label: "Allow", icon: <ListChecks size={18} /> },
  { path: "/schedule", label: "Schedule", icon: <CalendarDots size={18} /> },
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
      {/* Logo */}
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

      {/* Nav items */}
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
                minWidth: item.label === "Schedule" ? "66px" : "50px",
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

function App() {
  return (
    <Router>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "380px",
          minHeight: "520px",
          maxHeight: "600px",
          background: "var(--color-background)",
          fontFamily: "var(--font-sans)",
          overflow: "hidden",
        }}
      >
        <Topbar />
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            background: "var(--color-background)",
            color: "var(--color-foreground)",
          }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/blocklists" element={<Blocklists />} />
            <Route path="/whitelist" element={<Whitelist />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

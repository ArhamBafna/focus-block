import { ArrowLeft } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const sectionStyle: React.CSSProperties = {
  marginBottom: "14px",
  padding: "12px 14px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-lumen-dark)",
  borderRadius: "10px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "var(--color-vast)",
  margin: "0 0 6px",
};

const bodyStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-neutral-500)",
  lineHeight: 1.55,
  margin: 0,
};

const listItemStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-neutral-500)",
  lineHeight: 1.55,
};

export default function Privacy() {
  return (
    <div style={{ padding: "20px 20px", maxWidth: "380px" }}>
      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <Link
          to="/settings"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--color-neutral-500)",
            textDecoration: "none",
            marginBottom: "8px",
          }}
        >
          <ArrowLeft size={12} weight="bold" />
          Settings
        </Link>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-vast)", margin: 0, letterSpacing: "-0.3px" }}>
          Privacy
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-neutral-500)" }}>
          What Focus Blocker does — and does not do — with data.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>No servers. No accounts. No analytics.</h2>
        <p style={bodyStyle}>
          Focus Blocker has no servers and collects nothing. Everything stays
          inside your browser on your device. Nothing is collected, transmitted,
          sold, or shared — ever.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>What stays on your device</h2>
        <p style={bodyStyle}>Saved locally in your browser's storage:</p>
        <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
          <li style={listItemStyle}>Your block list and allow list</li>
          <li style={listItemStyle}>Temporary allow exceptions</li>
          <li style={listItemStyle}>Schedule windows you configure</li>
          <li style={listItemStyle}>Start/stop times of your own sessions</li>
          <li style={listItemStyle}>Stop-challenge settings</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>How the permissions are used</h2>
        <p style={bodyStyle}>
          <strong>Block sites</strong> — network rules that redirect blocked
          sites during a session. <strong>Storage</strong> — keeps your lists
          and settings on this device. <strong>Alarms</strong> — ends sessions
          and activates schedules on time. The extension never reads page
          contents or monitors activity beyond enforcing your own block rules.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Sharing</h2>
        <p style={bodyStyle}>
          We do not share, sell, rent, or transfer any data. There is no third
          party to share it with.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Retention and deletion</h2>
        <p style={bodyStyle}>
          Data is kept only until you remove it: clear history from the History
          tab, remove sites from the Block/Allow tabs, delete schedules
          anytime. Uninstalling the extension removes everything permanently —
          nothing is left on a server, because there are no servers.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Contact</h2>
        <p style={bodyStyle}>
          Questions? Open an issue at
          <br />
          github.com/ArhamBafna/focus-block/issues
        </p>
      </div>

      <p style={{ fontSize: "10px", color: "var(--color-neutral-400)", marginTop: "4px" }}>
        Full policy: arhambafna.github.io/focus-block/privacy
      </p>
    </div>
  );
}

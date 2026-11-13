import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, color: "#f87171", background: "#0f172a", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8, fontFamily: "sans-serif" }}>
          <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: 14 }}>Extension Error</h3>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: 12 }}>An unexpected error occurred in the popup.</p>
          <pre style={{ padding: 8, background: "#1e293b", borderRadius: 4, overflow: "auto", fontSize: 11, flex: 1 }}>{String(this.state.error?.message || this.state.error)}</pre>
          <button onClick={() => window.location.reload()} style={{ padding: "6px 12px", background: "#3b82f6", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, alignSelf: "flex-start" }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

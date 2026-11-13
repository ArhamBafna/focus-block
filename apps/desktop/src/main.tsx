import React from "react";
import ReactDOM from "react-dom/client";
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
        <div style={{ padding: 24, color: "#f87171", background: "#0f172a", height: "100vh", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12, fontFamily: "sans-serif" }}>
          <h2 style={{ margin: 0, color: "#f1f5f9" }}>Something went wrong</h2>
          <p style={{ color: "#94a3b8", margin: 0 }}>An unexpected error occurred in the desktop UI.</p>
          <pre style={{ padding: 12, background: "#1e293b", borderRadius: 6, overflow: "auto", fontSize: 12, flex: 1 }}>{String(this.state.error?.stack || this.state.error)}</pre>
          <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", background: "#3b82f6", color: "white", border: "none", borderRadius: 6, cursor: "pointer", alignSelf: "flex-start" }}>Reload App</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

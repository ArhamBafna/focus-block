import { useState, useEffect } from "react";
import { ipc, DomainEntry } from "../lib/ipc";
import { Trash, Plus } from "@phosphor-icons/react";

export default function Blocklists() {
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchDomains = async () => {
    try {
      setDomains(await ipc.listBlocklist());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setError(null);
    try {
      await ipc.addBlocklist(newDomain);
      setNewDomain("");
      fetchDomains();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <div style={{ padding: "20px 20px", maxWidth: "380px" }}>
      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <h1
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--color-vast)",
            margin: 0,
            letterSpacing: "-0.3px",
          }}
        >
          Blocklist
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-neutral-500)" }}>
          Sites blocked during every focus session.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <input
          type="text"
          value={newDomain}
          onChange={(e) => { setNewDomain(e.target.value); setError(null); }}
          placeholder="e.g. youtube.com"
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: "13px",
            fontFamily: "var(--font-sans)",
            border: error ? "1.5px solid #e05c5c" : "1.5px solid var(--color-lumen-dark)",
            borderRadius: "8px",
            background: "var(--color-surface)",
            color: "var(--color-vast)",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => !error && ((e.target as HTMLElement).style.borderColor = "var(--color-fathom)")}
          onBlur={(e) => !error && ((e.target as HTMLElement).style.borderColor = "var(--color-lumen-dark)")}
        />
        <button
          type="submit"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "8px 14px",
            fontSize: "13px",
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            background: "var(--color-vast)",
            color: "var(--color-lumen)",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        >
          <Plus size={13} weight="bold" />
          Add
        </button>
      </form>

      {/* Error */}
      {error && (
        <div
          style={{
            marginBottom: "12px",
            padding: "8px 12px",
            background: "#fff0f0",
            border: "1px solid #f8d0d0",
            borderRadius: "8px",
            fontSize: "12px",
            color: "var(--color-pulse)",
          }}
        >
          {error}
        </div>
      )}

      {/* Domain list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "340px", overflowY: "auto" }}>
        {domains.map((d) => (
          <div
            key={d.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-lumen-dark)",
              borderRadius: "8px",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-vast)" }}>
              {d.domain}
            </span>
            <button
              onClick={async () => { await ipc.removeBlocklist(d.id); fetchDomains(); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "3px",
                borderRadius: "5px",
                color: "var(--color-neutral-400)",
                display: "flex",
                alignItems: "center",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#e05c5c")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-neutral-400)")}
            >
              <Trash size={14} />
            </button>
          </div>
        ))}
        {domains.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "36px 0",
              color: "var(--color-neutral-400)",
              fontSize: "13px",
            }}
          >
            No domains yet. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}

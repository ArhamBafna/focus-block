import { useState, useEffect } from "react";
import { ipc, DomainEntry } from "../lib/ipc";
import { Trash, Plus } from "@phosphor-icons/react";

export default function Whitelist() {
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchDomains = async () => {
    try {
      setDomains(await ipc.listWhitelist());
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
      await ipc.addWhitelist(newDomain);
      setNewDomain("");
      fetchDomains();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: "720px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--color-vast)",
            margin: 0,
            letterSpacing: "-0.4px",
          }}
        >
          Whitelist
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--color-neutral-500)" }}>
          Sites always allowed, even during Lockdown mode.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
        <input
          type="text"
          value={newDomain}
          onChange={(e) => { setNewDomain(e.target.value); setError(null); }}
          placeholder="e.g. github.com or https://notion.so/"
          style={{
            flex: 1,
            padding: "10px 14px",
            fontSize: "14px",
            fontFamily: "var(--font-sans)",
            border: error ? "1.5px solid #e05c5c" : "1.5px solid var(--color-lumen-dark)",
            borderRadius: "10px",
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
            gap: "6px",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            background: "var(--color-vast)",
            color: "var(--color-lumen)",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        >
          <Plus size={15} weight="bold" />
          Add Domain
        </button>
      </form>

      {/* Error */}
      {error && (
        <div
          style={{
            marginBottom: "16px",
            padding: "10px 14px",
            background: "#fff0f0",
            border: "1px solid #f8d0d0",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#b02020",
          }}
        >
          {error}
        </div>
      )}

      {/* Domain list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {domains.map((d) => (
          <div
            key={d.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-lumen-dark)",
              borderRadius: "10px",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-vast)" }}>
              {d.domain}
            </span>
            <button
              onClick={async () => {
                await ipc.removeWhitelist(d.id);
                fetchDomains();
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "6px",
                color: "var(--color-neutral-400)",
                display: "flex",
                alignItems: "center",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#e05c5c")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-neutral-400)")}
            >
              <Trash size={16} />
            </button>
          </div>
        ))}
        {domains.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "var(--color-neutral-400)",
              fontSize: "14px",
            }}
          >
            No domains whitelisted. Sites added here bypass Lockdown mode.
          </div>
        )}
      </div>
    </div>
  );
}

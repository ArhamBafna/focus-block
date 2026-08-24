import { useState, useEffect } from "react";
import { ipc, AppBlockEntry, AppBlockTarget, DomainEntry } from "../lib/ipc";
import { File, Folder, Plus, SpinnerGap, Trash, WindowsLogo } from "@phosphor-icons/react";
import { listStoreApps, pickExecutable, pickFolder, StoreApp } from "../lib/app-picker";

type Notice = { tone: "success" | "error"; text: string } | null;

function appTargetDetails(target: AppBlockTarget) {
  if (target.kind === "executable") {
    return { label: "Executable", value: target.path, icon: <File size={17} /> };
  }
  if (target.kind === "folder") {
    return { label: "Folder", value: target.path, icon: <Folder size={17} /> };
  }
  return {
    label: "Microsoft Store app",
    value: target.package_family_name,
    icon: <WindowsLogo size={17} />,
  };
}

export default function Blocklists() {
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [appTargets, setAppTargets] = useState<AppBlockEntry[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appActionLoading, setAppActionLoading] = useState(false);
  const [storeApps, setStoreApps] = useState<StoreApp[]>([]);
  const [storeAppsLoading, setStoreAppsLoading] = useState(false);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [selectedPackageFamily, setSelectedPackageFamily] = useState("");
  const [appNotice, setAppNotice] = useState<Notice>(null);

  const fetchDomains = async () => {
    try {
      setDomains(await ipc.listBlocklist());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAppTargets = async () => {
    setAppsLoading(true);
    try {
      setAppTargets((await ipc.listAppBlockTargets()).targets);
    } catch (e: any) {
      setAppNotice({ tone: "error", text: e?.message || "Could not load app targets." });
    } finally {
      setAppsLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
    fetchAppTargets();
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

  const addAppTarget = async (target: AppBlockTarget, successMessage: string) => {
    setAppActionLoading(true);
    setAppNotice(null);
    try {
      await ipc.addAppBlockTarget(target);
      setAppTargets((await ipc.listAppBlockTargets()).targets);
      setAppNotice({ tone: "success", text: successMessage });
    } catch (e: any) {
      setAppNotice({ tone: "error", text: e?.message || "Could not add app target." });
    } finally {
      setAppActionLoading(false);
    }
  };

  const chooseExecutable = async () => {
    try {
      const path = await pickExecutable();
      if (path) await addAppTarget({ kind: "executable", path }, "Executable added to app blocking.");
    } catch (e: any) {
      setAppNotice({ tone: "error", text: e?.message || "Could not open executable picker." });
    }
  };

  const chooseFolder = async () => {
    try {
      const path = await pickFolder();
      if (path) await addAppTarget({ kind: "folder", path }, "Folder added to app blocking.");
    } catch (e: any) {
      setAppNotice({ tone: "error", text: e?.message || "Could not open folder picker." });
    }
  };

  const openStorePicker = async () => {
    setStorePickerOpen(true);
    setAppNotice(null);
    if (storeApps.length > 0) return;
    setStoreAppsLoading(true);
    try {
      const apps = await listStoreApps();
      setStoreApps(apps);
      setSelectedPackageFamily(apps[0]?.packageFamilyName || "");
      if (apps.length === 0) {
        setAppNotice({ tone: "error", text: "No Microsoft Store apps were found for this Windows account." });
      }
    } catch (e: any) {
      setAppNotice({ tone: "error", text: e?.message || "Could not list Microsoft Store apps." });
    } finally {
      setStoreAppsLoading(false);
    }
  };

  const addSelectedStoreApp = async () => {
    if (!selectedPackageFamily) return;
    await addAppTarget(
      { kind: "package", package_family_name: selectedPackageFamily },
      "Microsoft Store app added to app blocking.",
    );
  };

  const removeAppTarget = async (id: number) => {
    setAppActionLoading(true);
    setAppNotice(null);
    try {
      await ipc.removeAppBlockTarget(id);
      setAppTargets((await ipc.listAppBlockTargets()).targets);
      setAppNotice({ tone: "success", text: "App target removed." });
    } catch (e: any) {
      setAppNotice({ tone: "error", text: e?.message || "Could not remove app target." });
    } finally {
      setAppActionLoading(false);
    }
  };

  const appButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "9px 13px",
    fontSize: "13px",
    fontWeight: 600,
    fontFamily: "var(--font-sans)",
    background: "var(--color-surface)",
    color: "var(--color-vast)",
    border: "1px solid var(--color-lumen-dark)",
    borderRadius: "9px",
    cursor: "pointer",
  };

  return (
    <div style={{ padding: "20px", maxWidth: "720px" }}>
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
        <p style={{ margin: "5px 0 0", fontSize: "11px", color: "var(--color-neutral-400)" }}>
          <strong>*word</strong> applies to all URLs containing <strong>word</strong>.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <input
          type="text"
          value={newDomain}
          onChange={(e) => { setNewDomain(e.target.value); setError(null); }}
          placeholder="e.g. youtube.com or *game"
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
              onClick={async () => {
                await ipc.removeBlocklist(d.id);
                fetchDomains();
              }}
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

      <section style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid var(--color-lumen-dark)" }}>
        <div style={{ marginBottom: "18px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--color-vast)", letterSpacing: "-0.2px" }}>
            Apps
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: "14px", color: "var(--color-neutral-500)" }}>
            Apps blocked by Windows service during focus sessions. Website blocking stays unchanged.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
          <button type="button" onClick={chooseExecutable} disabled={appActionLoading} style={appButtonStyle}>
            <File size={16} /> Select .exe
          </button>
          <button type="button" onClick={chooseFolder} disabled={appActionLoading} style={appButtonStyle}>
            <Folder size={16} /> Select folder
          </button>
          <button type="button" onClick={openStorePicker} disabled={appActionLoading} style={appButtonStyle}>
            <WindowsLogo size={16} /> Select Store app
          </button>
        </div>

        {storePickerOpen && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "14px", padding: "12px", background: "var(--color-neutral-50)", borderRadius: "10px" }}>
            {storeAppsLoading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "7px", color: "var(--color-neutral-500)", fontSize: "13px" }}>
                <SpinnerGap size={16} className="animate-spin" /> Loading installed Store apps…
              </span>
            ) : (
              <>
                <select
                  value={selectedPackageFamily}
                  onChange={(event) => setSelectedPackageFamily(event.target.value)}
                  disabled={storeApps.length === 0 || appActionLoading}
                  style={{ flex: 1, minWidth: "180px", padding: "9px 10px", border: "1px solid var(--color-lumen-dark)", borderRadius: "8px", background: "var(--color-surface)", fontFamily: "var(--font-sans)", fontSize: "13px" }}
                >
                  {storeApps.map((app) => (
                    <option key={app.packageFamilyName} value={app.packageFamilyName}>
                      {app.displayName} — {app.packageFamilyName}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={addSelectedStoreApp} disabled={!selectedPackageFamily || appActionLoading} style={{ ...appButtonStyle, background: "var(--color-vast)", color: "var(--color-lumen)", borderColor: "var(--color-vast)" }}>
                  <Plus size={15} weight="bold" /> Add app
                </button>
              </>
            )}
          </div>
        )}

        {appNotice && (
          <div style={{ marginBottom: "14px", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", color: appNotice.tone === "error" ? "#b02020" : "var(--color-fathom)", background: appNotice.tone === "error" ? "#fff0f0" : "var(--color-accent-50)", border: `1px solid ${appNotice.tone === "error" ? "#f8d0d0" : "var(--color-accent-100)"}` }}>
            {appNotice.text}
          </div>
        )}

        {appsLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "24px 0", color: "var(--color-neutral-500)", fontSize: "14px" }}>
            <SpinnerGap size={17} className="animate-spin" /> Loading app targets…
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {appTargets.map((entry) => {
              const details = appTargetDetails(entry.target);
              return (
                <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: "11px", padding: "12px 14px", background: "var(--color-surface)", border: "1px solid var(--color-lumen-dark)", borderRadius: "10px" }}>
                  <span style={{ color: "var(--color-fathom)", display: "flex" }}>{details.icon}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "12px", color: "var(--color-neutral-500)", marginBottom: "2px" }}>{details.label}</div>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-vast)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={details.value}>{details.value}</div>
                  </div>
                  <button type="button" onClick={() => removeAppTarget(entry.id)} disabled={appActionLoading} aria-label={`Remove ${details.label}`} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", color: "var(--color-neutral-400)", display: "flex", alignItems: "center" }}>
                    <Trash size={16} />
                  </button>
                </div>
              );
            })}
            {appTargets.length === 0 && (
              <div style={{ textAlign: "center", padding: "30px 0", color: "var(--color-neutral-400)", fontSize: "14px" }}>
                No app targets added yet. Select an .exe, folder, or Microsoft Store app above.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

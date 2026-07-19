import { invoke } from "@tauri-apps/api/core";

export type SessionMode = "blocklist" | "lockdown";
export type SessionStatus = "active" | "completed" | "stopped";

export interface Session {
  id: string;
  preset_id: string | null;
  mode: SessionMode;
  started_at: string;
  ended_at: string | null;
  planned_duration_sec: number;
  status: SessionStatus;
  blocklist_snapshot: string[];
  whitelist_snapshot: string[];
}

export interface Preset {
  id: string;
  name: string;
  mode: SessionMode;
  duration_minutes: number;
  blocklist: string[];
  whitelist: string[];
}

export interface ActiveSessionView {
  session: Session;
  elapsed_sec: number;
  remaining_sec: number | null;
}

export interface DomainEntry {
  id: number;
  domain: string;
}

export type AppBlockTarget =
  | { kind: "executable"; path: string }
  | { kind: "folder"; path: string }
  | { kind: "package"; package_family_name: string };

export interface AppBlockEntry {
  id: number;
  target: AppBlockTarget;
}

interface AppBlockTargetList {
  targets: AppBlockEntry[];
}

export interface ServiceHealth {
  running: boolean;
  version: string;
}

export interface ServiceStatus {
  health: ServiceHealth;
  active_session: ActiveSessionView | null;
}

export interface AppSettings {
  os_allowlist_enabled: boolean;
}

const isTauri = typeof window !== "undefined" && (
  (window as any).__TAURI_INTERNALS__ !== undefined || 
  (window as any).__TAURI_IPC__ !== undefined
);

export function normalizeDomain(input: string): string | null {
  let str = input.trim().toLowerCase();
  if (!str) return null;

  if (str.startsWith("http://")) {
    str = str.slice(7);
  } else if (str.startsWith("https://")) {
    str = str.slice(8);
  }

  const slashIndex = str.indexOf("/");
  if (slashIndex !== -1) {
    str = str.slice(0, slashIndex);
  }

  const queryIndex = str.indexOf("?");
  if (queryIndex !== -1) {
    str = str.slice(0, queryIndex);
  }

  const hashIndex = str.indexOf("#");
  if (hashIndex !== -1) {
    str = str.slice(0, hashIndex);
  }

  const colonIndex = str.indexOf(":");
  if (colonIndex !== -1) {
    str = str.slice(0, colonIndex);
  }

  if (str.startsWith("www.")) {
    str = str.slice(4);
  }

  if (!str || str.includes(" ") || !str.includes(".")) {
    return null;
  }

  return str;
}

function handleMockRequest<T>(cmd: string, data?: any): T {
  const getStorage = <V>(key: string, defaultValue: V): V => {
    const val = localStorage.getItem(`mock_${key}`);
    return val ? JSON.parse(val) : defaultValue;
  };
  const setStorage = <V>(key: string, value: V): void => {
    localStorage.setItem(`mock_${key}`, JSON.stringify(value));
  };

  switch (cmd) {
    case "Ping":
      return null as unknown as T;
    
    case "Health":
      return {
        running: true,
        version: "0.1.0-mock",
      } as unknown as T;

    case "GetStatus": {
      const activeSession = getStorage<Session | null>("active_session", null);
      let activeView = null;
      if (activeSession && activeSession.status === "active") {
        const elapsed = Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 1000);
        const remaining = Math.max(0, activeSession.planned_duration_sec - elapsed);
        if (remaining <= 0) {
          activeSession.status = "completed";
          activeSession.ended_at = new Date().toISOString();
          setStorage("active_session", null);
          const history = getStorage<Session[]>("history", []);
          history.unshift(activeSession);
          setStorage("history", history);
        } else {
          activeView = {
            session: activeSession,
            elapsed_sec: elapsed,
            remaining_sec: remaining,
          };
        }
      }
      return {
        health: { running: true, version: "0.1.0-mock" },
        active_session: activeView,
      } as unknown as T;
    }

    case "ListBlocklist":
      return getStorage<DomainEntry[]>("blocklist", []) as unknown as T;

    case "AddBlocklist": {
      const list = getStorage<DomainEntry[]>("blocklist", []);
      const newDomain = data.domain;
      const id = Date.now();
      if (!list.some(d => d.domain === newDomain)) {
        list.push({ id, domain: newDomain });
        setStorage("blocklist", list);
      }
      return id as unknown as T;
    }

    case "RemoveBlocklist": {
      let list = getStorage<DomainEntry[]>("blocklist", []);
      list = list.filter(d => d.id !== data.id);
      setStorage("blocklist", list);
      return null as unknown as T;
    }

    case "ListWhitelist":
      return getStorage<DomainEntry[]>("whitelist", []) as unknown as T;

    case "AddWhitelist": {
      const list = getStorage<DomainEntry[]>("whitelist", []);
      const newDomain = data.domain;
      const id = Date.now();
      if (!list.some(d => d.domain === newDomain)) {
        list.push({ id, domain: newDomain });
        setStorage("whitelist", list);
      }
      return id as unknown as T;
    }

    case "RemoveWhitelist": {
      let list = getStorage<DomainEntry[]>("whitelist", []);
      list = list.filter(d => d.id !== data.id);
      setStorage("whitelist", list);
      return null as unknown as T;
    }

    case "ListPresets":
      return getStorage<Preset[]>("presets", []) as unknown as T;

    case "CreatePreset": {
      const presets = getStorage<Preset[]>("presets", []);
      const newPreset: Preset = {
        id: Math.random().toString(36).substr(2, 9),
        name: data.name,
        mode: data.mode,
        duration_minutes: data.duration_minutes,
        blocklist: data.blocklist,
        whitelist: data.whitelist,
      };
      presets.push(newPreset);
      setStorage("presets", presets);
      return null as unknown as T;
    }

    case "DeletePreset": {
      let presets = getStorage<Preset[]>("presets", []);
      presets = presets.filter(p => p.id !== data.id);
      setStorage("presets", presets);
      return null as unknown as T;
    }

    case "StartSession": {
      const activeSession = getStorage<Session | null>("active_session", null);
      if (activeSession && activeSession.status === "active") {
        throw new Error("Session already active");
      }
      const blocklist = getStorage<DomainEntry[]>("blocklist", []).map(d => d.domain);
      const whitelist = getStorage<DomainEntry[]>("whitelist", []).map(d => d.domain);
      const newSession: Session = {
        id: Math.random().toString(36).substr(2, 9),
        preset_id: data.preset_id || null,
        mode: data.mode,
        started_at: new Date().toISOString(),
        ended_at: null,
        planned_duration_sec: data.duration_minutes * 60,
        status: "active",
        blocklist_snapshot: blocklist,
        whitelist_snapshot: whitelist,
      };
      setStorage("active_session", newSession);
      return null as unknown as T;
    }

    case "StopSession": {
      const activeSession = getStorage<Session | null>("active_session", null);
      if (activeSession) {
        activeSession.status = "stopped";
        activeSession.ended_at = new Date().toISOString();
        setStorage("active_session", null);
        const history = getStorage<Session[]>("history", []);
        history.unshift(activeSession);
        setStorage("history", history);
      }
      return null as unknown as T;
    }

    case "ListHistory": {
      const history = getStorage<Session[]>("history", []);
      const limit = data?.limit || 50;
      return history.slice(0, limit) as unknown as T;
    }

    case "ClearHistory":
      setStorage("history", []);
      return null as unknown as T;

    case "GetSettings":
      return getStorage<AppSettings>("settings", {
        os_allowlist_enabled: false,
      }) as unknown as T;

    case "UpdateSettings": {
      const settings = getStorage<AppSettings>("settings", {
        os_allowlist_enabled: false,
      });
      settings.os_allowlist_enabled = data.os_allowlist_enabled;
      setStorage("settings", settings);
      return null as unknown as T;
    }

    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}

// Request helpers
async function request<T>(cmd: string, data?: any): Promise<T> {
  if (!isTauri) {
    return Promise.resolve(handleMockRequest<T>(cmd, data));
  }
  const req = data ? { cmd, data } : { cmd };
  const res = await invoke<any>("ipc_request", { request: req });
  if (res.status === "Ok") {
    // Serde serializes `Ok { data: ResponseData }` with `tag="status", content="data"` 
    // as `{ "status": "Ok", "data": { "data": <actual_payload> } }`. We must unwrap the extra "data".
    const payload = (res.data && res.data.data !== undefined) ? res.data.data : res.data;
    return payload as T;
  }
  throw new Error(res.message);
}

export const ipc = {
  ping: () => request<null>("Ping"),
  getHealth: () => request<ServiceHealth>("Health"),
  getStatus: () => request<ServiceStatus>("GetStatus"),
  
  listBlocklist: () => request<DomainEntry[]>("ListBlocklist"),
  addBlocklist: (domain: string) => {
    const norm = normalizeDomain(domain);
    if (!norm) return Promise.reject(new Error("Invalid domain format"));
    return request<number>("AddBlocklist", { domain: norm });
  },
  removeBlocklist: (id: number) => request<null>("RemoveBlocklist", { id }),

  listAppBlockTargets: async () => (await request<AppBlockTargetList>("ListAppBlockTargets")).targets,
  addAppBlockTarget: (target: AppBlockTarget) => request<number>("AddAppBlockTarget", { target }),
  removeAppBlockTarget: (id: number) => request<null>("RemoveAppBlockTarget", { id }),

  listWhitelist: () => request<DomainEntry[]>("ListWhitelist"),
  addWhitelist: (domain: string) => {
    const norm = normalizeDomain(domain);
    if (!norm) return Promise.reject(new Error("Invalid domain format"));
    return request<number>("AddWhitelist", { domain: norm });
  },
  removeWhitelist: (id: number) => request<null>("RemoveWhitelist", { id }),

  listPresets: () => request<Preset[]>("ListPresets"),
  createPreset: (name: string, mode: SessionMode, duration_minutes: number, blocklist: string[], whitelist: string[]) => {
    const normBlocklist = blocklist.map(d => normalizeDomain(d)).filter((d): d is string => !!d);
    const normWhitelist = whitelist.map(d => normalizeDomain(d)).filter((d): d is string => !!d);
    return request<null>("CreatePreset", { name, mode, duration_minutes, blocklist: normBlocklist, whitelist: normWhitelist });
  },
  deletePreset: (id: string) => request<null>("DeletePreset", { id }),

  startSession: (mode: SessionMode, duration_minutes: number, preset_id?: string) => 
    request<null>("StartSession", { mode, duration_minutes, preset_id }),
  stopSession: () => request<null>("StopSession"),

  listHistory: (limit: number = 50) => request<Session[]>("ListHistory", { limit }),
  clearHistory: () => request<null>("ClearHistory"),
  
  getSettings: () => request<AppSettings>("GetSettings"),
  updateSettings: (os_allowlist_enabled: boolean) => request<null>("UpdateSettings", { os_allowlist_enabled }),
};

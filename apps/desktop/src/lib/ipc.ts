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
  scheduled_schedule_id?: string | null;
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
  | { kind: "package"; package_family_name: string };

export interface BlockedAppEvent {
  app_name: string;
  executable_path?: string;
  package_family_name?: string;
  timestamp: string;
  count: number;
}

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
  last_blocked_app?: BlockedAppEvent | null;
}

export interface AppSettings {
  os_allowlist_enabled: boolean;
}

export interface Schedule {
  id: string;
  start_time: string;
  end_time: string;
  mode: SessionMode;
  days_of_week: number[];
  ends_on: string | null;
}

export interface ScheduleList {
  schedules: Schedule[];
}


const isTauri = typeof window !== "undefined" && (
  (window as any).__TAURI_INTERNALS__ !== undefined || 
  (window as any).__TAURI_IPC__ !== undefined
);

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function parseTime(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDays(days: number[]): number[] {
  return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
}

function dateRangesOverlap(firstEndsOn: string | null, secondEndsOn: string | null): boolean {
  const today = localDateKey();
  return (firstEndsOn === null || firstEndsOn >= today) && (secondEndsOn === null || secondEndsOn >= today);
}

export function validateSchedule(
  startTime: string,
  endTime: string,
  daysOfWeek: number[],
  endsOn: string | null,
  existingSchedules: Schedule[],
  excludedId?: string
): { days: number[]; endsOn: string | null } {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (start === null || end === null) throw new Error("Enter valid start and end times.");
  if (start >= end) throw new Error("End time must be after start time.");

  const days = normalizeDays(daysOfWeek);
  if (days.length === 0) throw new Error("Choose at least one day.");

  if (endsOn !== null) {
    if (!isDateKey(endsOn)) throw new Error("Choose a valid end date.");
    if (endsOn < localDateKey()) throw new Error("End date cannot be in the past.");
  }

  const overlap = existingSchedules.find((schedule) => {
    if (schedule.id === excludedId) return false;
    const existingStart = parseTime(schedule.start_time);
    const existingEnd = parseTime(schedule.end_time);
    return (
      existingStart !== null &&
      existingEnd !== null &&
      start < existingEnd &&
      end > existingStart &&
      schedule.days_of_week.some((day) => days.includes(day)) &&
      dateRangesOverlap(schedule.ends_on, endsOn)
    );
  });

  if (overlap) {
    throw new Error(`Schedule overlaps with ${overlap.start_time}–${overlap.end_time} on one or more selected days.`);
  }

  return { days, endsOn };
}

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
      const lastBlocked = getStorage<BlockedAppEvent | null>("last_blocked_app", null);
      return {
        health: { running: true, version: "0.1.0-mock" },
        active_session: activeView,
        ...(lastBlocked ? { last_blocked_app: lastBlocked } : {}),
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

    case "ListAppBlockTargets":
      return { targets: getStorage<AppBlockEntry[]>("app_block_targets", []) } as unknown as T;

    case "AddAppBlockTarget": {
      const list = getStorage<AppBlockEntry[]>("app_block_targets", []);
      const id = Date.now();
      // Simple duplicate check could be done here, but ignoring for mock
      list.push({ id, target: data.target });
      setStorage("app_block_targets", list);
      return id as unknown as T;
    }

    case "RemoveAppBlockTarget": {
      let list = getStorage<AppBlockEntry[]>("app_block_targets", []);
      list = list.filter(t => t.id !== data.id);
      setStorage("app_block_targets", list);
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

    case "ListSchedules":
      return { schedules: getStorage<Schedule[]>("schedules", []) } as unknown as T;

    case "CreateSchedule": {
      const schedules = getStorage<Schedule[]>("schedules", []);
      const schedule = data.schedule as Schedule;
      schedules.push(schedule);
      setStorage("schedules", schedules);
      return null as unknown as T;
    }

    case "UpdateSchedule": {
      let schedules = getStorage<Schedule[]>("schedules", []);
      const updated = data.schedule as Schedule;
      schedules = schedules.map(s => s.id === updated.id ? updated : s);
      setStorage("schedules", schedules);
      return null as unknown as T;
    }

    case "DeleteSchedule": {
      let schedules = getStorage<Schedule[]>("schedules", []);
      schedules = schedules.filter(s => s.id !== data.id);
      setStorage("schedules", schedules);
      const activeSession = getStorage<Session | null>("active_session", null);
      if (activeSession && activeSession.scheduled_schedule_id === data.id) {
        activeSession.status = "stopped";
        activeSession.ended_at = new Date().toISOString();
        setStorage("active_session", null);
        const history = getStorage<Session[]>("history", []);
        history.unshift(activeSession);
        setStorage("history", history);
      }
      return null as unknown as T;
    }
    case "ClearLastBlockedApp": {
      setStorage("last_blocked_app", null);
      return null as unknown as T;
    }

    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}

// ── Bridge envelope ──────────────────────────────────────────────────────────
//
// The bridge resolves EVERY command with exactly one envelope. Application
// errors and transport failures travel the same channel as distinct arms, so
// callers never guess payload shapes or juggle rejected promises.

export type BridgeFailureKind = "app" | "unavailable";

export interface BridgeFailure {
  kind: BridgeFailureKind;
  message: string;
}

export type BridgeEnvelope<T> = { ok: true; data: T } | ({ ok: false } & BridgeFailure);

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function request<T>(cmd: string, data?: any): Promise<BridgeEnvelope<T>> {
  if (!isTauri) {
    try {
      return { ok: true, data: handleMockRequest<T>(cmd, data) };
    } catch (e) {
      return { ok: false, kind: "app", message: errorMessage(e) };
    }
  }

  const req = data ? { cmd, data } : { cmd };

  let raw: any;
  try {
    raw = await invoke<any>("ipc_request", { request: req });
  } catch (e) {
    // Rejection means the bridge/daemon itself failed, not the command.
    return { ok: false, kind: "unavailable", message: errorMessage(e) };
  }

  // Decode once, typed: IpcResponse is tagged `status` with the payload
  // inline under `data`; no shape guessing.
  if (raw?.status === "Ok") {
    return { ok: true, data: raw.data as T };
  }
  if (raw?.status === "Err") {
    return { ok: false, kind: "app", message: String(raw.message ?? "Unknown service error") };
  }
  return { ok: false, kind: "unavailable", message: "Unrecognized bridge response" };
}

/** Turn an envelope into a plain promise; the error carries its kind. */
function unwrap<T>(envelope: BridgeEnvelope<T>): Promise<T> {
  if (envelope.ok) return Promise.resolve(envelope.data);
  const error = new Error(envelope.message) as Error & { kind?: BridgeFailureKind };
  error.kind = envelope.kind;
  return Promise.reject(error);
}

export const ipc = {
  ping: () => request<null>("Ping").then(unwrap),
  getHealth: () => request<ServiceHealth>("Health").then(unwrap),
  getStatus: () => request<ServiceStatus>("GetStatus").then(unwrap),

  /** Envelope-returning status probe: daemon-down is an arm, never a throw. */
  getStatusSafe: () => request<ServiceStatus>("GetStatus"),
  
  listBlocklist: () => request<DomainEntry[]>("ListBlocklist").then(unwrap),
  addBlocklist: (domain: string) => {
    const norm = normalizeDomain(domain);
    if (!norm) return Promise.reject(new Error("Invalid domain format"));
    return request<number>("AddBlocklist", { domain: norm }).then(unwrap);
  },
  removeBlocklist: (id: number) => request<null>("RemoveBlocklist", { id }).then(unwrap),

  listAppBlockTargets: async () => (await request<AppBlockTargetList>("ListAppBlockTargets").then(unwrap)),
  addAppBlockTarget: (target: AppBlockTarget) => request<number>("AddAppBlockTarget", { target }).then(unwrap),
  removeAppBlockTarget: (id: number) => request<null>("RemoveAppBlockTarget", { id }).then(unwrap),

  listWhitelist: () => request<DomainEntry[]>("ListWhitelist").then(unwrap),
  addWhitelist: (domain: string) => {
    const norm = normalizeDomain(domain);
    if (!norm) return Promise.reject(new Error("Invalid domain format"));
    return request<number>("AddWhitelist", { domain: norm }).then(unwrap);
  },
  removeWhitelist: (id: number) => request<null>("RemoveWhitelist", { id }).then(unwrap),

  listPresets: () => request<Preset[]>("ListPresets").then(unwrap),
  createPreset: (name: string, mode: SessionMode, duration_minutes: number, blocklist: string[], whitelist: string[]) => {
    const normBlocklist = blocklist.map(d => normalizeDomain(d)).filter((d): d is string => !!d);
    const normWhitelist = whitelist.map(d => normalizeDomain(d)).filter((d): d is string => !!d);
    return request<null>("CreatePreset", { name, mode, duration_minutes, blocklist: normBlocklist, whitelist: normWhitelist }).then(unwrap);
  },
  deletePreset: (id: string) => request<null>("DeletePreset", { id }).then(unwrap),

  startSession: (mode: SessionMode, duration_minutes: number, preset_id?: string) =>
    request<null>("StartSession", { mode, duration_minutes, preset_id }).then(unwrap),
  stopSession: () => request<null>("StopSession").then(unwrap),

  listHistory: (limit: number = 50) => request<Session[]>("ListHistory", { limit }).then(unwrap),
  clearHistory: () => request<null>("ClearHistory").then(unwrap),

  getSettings: () => request<AppSettings>("GetSettings").then(unwrap),
  updateSettings: (os_allowlist_enabled: boolean) => request<null>("UpdateSettings", { os_allowlist_enabled }).then(unwrap),

  clearLastBlockedApp: () => request<null>("ClearLastBlockedApp").then(unwrap),
  listSchedules: async (): Promise<Schedule[]> => {
    const res = await request<ScheduleList>("ListSchedules").then(unwrap);
    return res?.schedules ?? [];
  },
  createSchedule: async (
    startTime: string,
    endTime: string,
    mode: SessionMode,
    daysOfWeek: number[] = ALL_DAYS,
    endsOn: string | null = null
  ): Promise<Schedule> => {
    const schedules = await ipc.listSchedules();
    const { days, endsOn: cleanEndsOn } = validateSchedule(
      startTime,
      endTime,
      daysOfWeek,
      endsOn,
      schedules
    );

    const schedule: Schedule = {
      id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      start_time: startTime,
      end_time: endTime,
      mode,
      days_of_week: days,
      ends_on: cleanEndsOn,
    };

    await request<null>("CreateSchedule", { schedule }).then(unwrap);
    return schedule;
  },
  updateSchedule: async (
    id: string,
    startTime: string,
    endTime: string,
    mode: SessionMode,
    daysOfWeek: number[],
    endsOn: string | null
  ): Promise<Schedule> => {
    const schedules = await ipc.listSchedules();
    if (!schedules.some((s) => s.id === id)) {
      throw new Error("Schedule no longer exists.");
    }
    const { days, endsOn: cleanEndsOn } = validateSchedule(
      startTime,
      endTime,
      daysOfWeek,
      endsOn,
      schedules,
      id
    );

    const schedule: Schedule = {
      id,
      start_time: startTime,
      end_time: endTime,
      mode,
      days_of_week: days,
      ends_on: cleanEndsOn,
    };

    await request<null>("UpdateSchedule", { schedule }).then(unwrap);
    return schedule;
  },
  deleteSchedule: (id: string) => request<null>("DeleteSchedule", { id }).then(unwrap),

};

export function setMockBlockedApp(event: BlockedAppEvent | null): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("mock_last_blocked_app", JSON.stringify(event));
  }
}

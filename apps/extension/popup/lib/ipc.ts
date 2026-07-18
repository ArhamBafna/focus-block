/**
 * Popup IPC facade.
 *
 * The desktop service owns all focus data. Popup requests travel through the
 * MV3 worker and the registered native host; this file never persists sessions,
 * lists, presets, history, or settings in extension storage.
 */

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

export interface Schedule {
  id: string;
  start_time: string;
  end_time: string;
  mode: SessionMode;
  days_of_week: number[];
  ends_on: string | null;
}

export interface ActiveSessionView {
  session: Session;
  elapsed_sec: number;
  remaining_sec: number | null;
}

export interface ActiveChallengeView {
  type: string;
  status: "pending" | "passed";
}

export interface DomainEntry {
  id: number;
  domain: string;
}

export interface TemporaryAllowEntry {
  id: string;
  domain: string;
  expires_at: number;
}

export interface ServiceHealth {
  running: boolean;
  version: string;
}

export interface ServiceStatus {
  health: ServiceHealth;
  active_session: ActiveSessionView | null;
  active_challenge: ActiveChallengeView | null;
}

export interface AppSettings {
  os_allowlist_enabled: boolean;
  stop_challenge: string;
  challenge_countdown_duration: number;
  challenge_countdown_breathing: boolean;
}

interface IpcResponse {
  status: "Ok" | "Err";
  data?: unknown;
  message?: string;
}

const DEFAULT_UI_SETTINGS: Omit<AppSettings, "os_allowlist_enabled"> = {
  stop_challenge: "none",
  challenge_countdown_duration: 30,
  challenge_countdown_breathing: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapServiceData(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return Object.prototype.hasOwnProperty.call(value, "data") ? value.data : value;
}

async function request<T>(cmd: string, data?: unknown): Promise<T> {
  const response = await chrome.runtime.sendMessage({
    type: "focusblock-service-request",
    request: data === undefined ? { cmd } : { cmd, data },
  }) as IpcResponse;

  if (!isRecord(response) || (response.status !== "Ok" && response.status !== "Err")) {
    throw new Error("FocusBlock service returned an invalid response.");
  }
  if (response.status === "Err") {
    throw new Error(typeof response.message === "string" ? response.message : "FocusBlock service rejected request.");
  }
  return unwrapServiceData(response.data) as T;
}

function desktopOnly(feature: string): never {
  throw new Error(`${feature} is managed by FocusBlock desktop app.`);
}

export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;

  if (value.startsWith("*")) {
    const wildcard = value.slice(1).trim();
    return wildcard && !/[ *|^]/.test(wildcard) ? `*${wildcard}` : null;
  }
  if (value.startsWith("http://")) value = value.slice(7);
  else if (value.startsWith("https://")) value = value.slice(8);

  value = value.split(/[/?#]/, 1)[0] ?? "";
  value = value.split(":", 1)[0] ?? "";
  value = value.replace(/^www\./, "");
  return value && !value.includes(" ") && value.includes(".") ? value : null;
}

export const ipc = {
  ping: (): Promise<null> => request<null>("Ping"),
  getHealth: (): Promise<ServiceHealth> => request<ServiceHealth>("Health"),

  getStatus: async (): Promise<ServiceStatus> => {
    const status = await request<Omit<ServiceStatus, "active_challenge">>("GetStatus");
    return { ...status, active_challenge: null };
  },

  listBlocklist: (): Promise<DomainEntry[]> => request<DomainEntry[]>("ListBlocklist"),
  addBlocklist: (domain: string): Promise<number> => {
    const normalized = normalizeDomain(domain);
    if (!normalized) return Promise.reject(new Error("Invalid site or wildcard format."));
    return request<number>("AddBlocklist", { domain: normalized });
  },
  removeBlocklist: (id: number): Promise<null> => request<null>("RemoveBlocklist", { id }),

  listWhitelist: (): Promise<DomainEntry[]> => request<DomainEntry[]>("ListWhitelist"),
  addWhitelist: (domain: string): Promise<number> => {
    const normalized = normalizeDomain(domain);
    if (!normalized) return Promise.reject(new Error("Invalid site or wildcard format."));
    return request<number>("AddWhitelist", { domain: normalized });
  },
  removeWhitelist: (id: number): Promise<null> => request<null>("RemoveWhitelist", { id }),

  listPresets: (): Promise<Preset[]> => request<Preset[]>("ListPresets"),
  createPreset: (
    name: string,
    mode: SessionMode,
    duration_minutes: number,
    blocklist: string[],
    whitelist: string[],
  ): Promise<null> => request<null>("CreatePreset", {
    name,
    mode,
    duration_minutes,
    blocklist: blocklist.map(normalizeDomain).filter((domain): domain is string => Boolean(domain)),
    whitelist: whitelist.map(normalizeDomain).filter((domain): domain is string => Boolean(domain)),
  }),
  deletePreset: (id: string): Promise<null> => request<null>("DeletePreset", { id }),

  startSession: (mode: SessionMode, duration_minutes: number, preset_id?: string): Promise<null> =>
    request<null>("StartSession", { mode, duration_minutes, preset_id }),
  stopSession: (): Promise<null> => request<null>("StopSession"),

  listHistory: (limit = 50): Promise<Session[]> => request<Session[]>("ListHistory", { limit }),
  clearHistory: (): Promise<null> => request<null>("ClearHistory"),

  getSettings: async (): Promise<AppSettings> => ({
    ...DEFAULT_UI_SETTINGS,
    ...(await request<{ os_allowlist_enabled: boolean }>("GetSettings")),
  }),
  updateSettings: (settings: AppSettings): Promise<null> =>
    request<null>("UpdateSettings", { os_allowlist_enabled: settings.os_allowlist_enabled }),

  // No matching desktop service protocol exists for these former extension-only states.
  // Reject instead of silently creating a second policy source in chrome.storage.
  listTemporaryAllows: async (): Promise<TemporaryAllowEntry[]> => desktopOnly("Temporary allowlists"),
  addTemporaryAllow: async (_domain: string, _durationMinutes: number): Promise<TemporaryAllowEntry> =>
    desktopOnly("Temporary allowlists"),
  removeTemporaryAllow: async (_id: string): Promise<null> => desktopOnly("Temporary allowlists"),
  getSchedules: async (): Promise<Schedule[]> => desktopOnly("Schedules"),
  createSchedule: async (
    _startTime: string,
    _endTime: string,
    _mode: SessionMode,
    _daysOfWeek?: number[],
    _endsOn?: string | null,
  ): Promise<Schedule> => desktopOnly("Schedules"),
  updateSchedule: async (
    _id: string,
    _startTime: string,
    _endTime: string,
    _mode: SessionMode,
    _daysOfWeek: number[],
    _endsOn: string | null,
  ): Promise<Schedule> => desktopOnly("Schedules"),
  deleteSchedule: async (_id: string): Promise<null> => desktopOnly("Schedules"),
  startChallenge: async (_type: string): Promise<null> => desktopOnly("Stop challenges"),
  cancelChallenge: async (): Promise<null> => desktopOnly("Stop challenges"),
};

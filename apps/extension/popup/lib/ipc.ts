/**
 * Extension-owned data facade. Every feature works from chrome.storage.local.
 * A desktop bridge may mirror only permanent Block/Allow entries; it is never
 * required for a browser session, schedule, temporary allow, or history item.
 */

import { ScheduleRecord, storageGet, storageSet } from "./storage";

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
  source?: "desktop";
}

export interface Preset {
  id: string;
  name: string;
  mode: SessionMode;
  duration_minutes: number;
  blocklist: string[];
  whitelist: string[];
}

export interface Schedule extends ScheduleRecord {}
export interface ActiveSessionView { session: Session; elapsed_sec: number; remaining_sec: number | null; }
export interface ActiveChallengeView { type: string; status: "pending" | "passed"; }
export interface DomainEntry { id: number; domain: string; }
export interface TemporaryAllowEntry { id: string; domain: string; expires_at: number; }
export interface ServiceHealth { running: boolean; version: string; }
export interface ServiceStatus {
  health: ServiceHealth;
  active_session: ActiveSessionView | null;
  active_challenge: ActiveChallengeView | null;
  desktop_session_active: boolean;
}
export interface AppSettings {
  os_allowlist_enabled: boolean;
  stop_challenge: string;
  challenge_countdown_duration: number;
  challenge_countdown_breathing: boolean;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
type SyncScope = "blocklist" | "whitelist";

function parseTime(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeDays(days: number[]): number[] {
  return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
}

function validateSchedule(
  startTime: string,
  endTime: string,
  daysOfWeek: number[],
  endsOn: string | null,
  schedules: Schedule[],
  excludedId?: string,
): { days: number[]; endsOn: string | null } {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (start === null || end === null || start >= end) throw new Error("End time must be after start time.");
  const days = normalizeDays(daysOfWeek);
  if (days.length === 0) throw new Error("Choose at least one day.");
  if (endsOn !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(endsOn) || endsOn < localDateKey())) {
    throw new Error("Choose a valid end date.");
  }
  const overlap = schedules.find((schedule) => {
    if (schedule.id === excludedId) return false;
    const existingStart = parseTime(schedule.start_time);
    const existingEnd = parseTime(schedule.end_time);
    return existingStart !== null && existingEnd !== null && start < existingEnd && end > existingStart
      && schedule.days_of_week.some((day) => days.includes(day))
      && (schedule.ends_on === null || schedule.ends_on >= localDateKey())
      && (endsOn === null || endsOn >= localDateKey());
  });
  if (overlap) throw new Error(`Schedule overlaps with ${overlap.start_time}–${overlap.end_time} on one or more selected days.`);
  return { days, endsOn };
}

export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith("*")) {
    const wildcard = value.slice(1).trim();
    return wildcard && !/[ *|^]/.test(wildcard) ? `*${wildcard}` : null;
  }
  value = value.replace(/^https?:\/\//, "").split(/[/?#]/, 1)[0]?.split(":", 1)[0]?.replace(/^www\./, "") ?? "";
  return value && !value.includes(" ") && value.includes(".") ? value : null;
}

async function sendDesktopSync(message: Record<string, unknown>): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "focusblock-browser-sync", ...message });
  } catch {
    // No native host is normal for Chrome Web Store-only users.
  }
}

async function recordRemoval(scope: SyncScope, domain: string): Promise<void> {
  const tombstones = await storageGet("desktop_sync_tombstones");
  if (!tombstones.some((item) => item.scope === scope && item.domain === domain)) {
    await storageSet("desktop_sync_tombstones", [...tombstones, { scope, domain }]);
  }
}

async function clearRemoval(scope: SyncScope, domain: string): Promise<void> {
  const tombstones = await storageGet("desktop_sync_tombstones");
  await storageSet("desktop_sync_tombstones", tombstones.filter((item) => item.scope !== scope || item.domain !== domain));
}

function activeView(session: Session): ActiveSessionView {
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000));
  return { session, elapsed_sec: elapsed, remaining_sec: Math.max(0, session.planned_duration_sec - elapsed) };
}

async function archive(session: Session, status: SessionStatus): Promise<void> {
  const history = await storageGet("history");
  await storageSet("history", [{ ...session, status, ended_at: new Date().toISOString() }, ...history]);
}

export const ipc = {
  ping: async (): Promise<null> => null,
  getHealth: async (): Promise<ServiceHealth> => ({ running: true, version: "0.1.0-extension" }),

  getStatus: async (): Promise<ServiceStatus> => {
    let local = await storageGet("active_session");
    if (local?.status === "active" && Date.now() >= new Date(local.started_at).getTime() + local.planned_duration_sec * 1000) {
      await archive(local, "completed");
      await storageSet("active_session", null);
      local = null;
    }
    const desktop = await storageGet("desktop_session");
    const active = local?.status === "active"
      ? activeView(local)
      : desktop?.status === "active"
        ? activeView({ ...desktop, source: "desktop" })
        : null;
    return {
      health: { running: true, version: "0.1.0-extension" },
      active_session: active,
      active_challenge: await storageGet("active_challenge"),
      desktop_session_active: desktop?.status === "active",
    };
  },

  listBlocklist: async (): Promise<DomainEntry[]> => {
    await sendDesktopSync({ reason: "refresh" });
    return storageGet("blocklist");
  },
  addBlocklist: async (domain: string): Promise<number> => {
    const normalized = normalizeDomain(domain);
    if (!normalized) throw new Error("Invalid site or wildcard format.");
    const list = await storageGet("blocklist");
    if (list.some((entry) => entry.domain === normalized)) throw new Error("Domain already in blocklist.");
    const id = Date.now();
    await storageSet("blocklist", [...list, { id, domain: normalized }]);
    await clearRemoval("blocklist", normalized);
    void sendDesktopSync({ reason: "list-change", scope: "blocklist", operation: "add", domain: normalized });
    return id;
  },
  removeBlocklist: async (id: number): Promise<null> => {
    const list = await storageGet("blocklist");
    const entry = list.find((item) => item.id === id);
    await storageSet("blocklist", list.filter((item) => item.id !== id));
    if (entry) {
      await recordRemoval("blocklist", entry.domain);
      void sendDesktopSync({ reason: "list-change", scope: "blocklist", operation: "remove", domain: entry.domain });
    }
    return null;
  },

  listWhitelist: async (): Promise<DomainEntry[]> => {
    await sendDesktopSync({ reason: "refresh" });
    return storageGet("whitelist");
  },
  addWhitelist: async (domain: string): Promise<number> => {
    const normalized = normalizeDomain(domain);
    if (!normalized) throw new Error("Invalid site or wildcard format.");
    const list = await storageGet("whitelist");
    if (list.some((entry) => entry.domain === normalized)) throw new Error("Domain already in allowlist.");
    const id = Date.now();
    await storageSet("whitelist", [...list, { id, domain: normalized }]);
    await clearRemoval("whitelist", normalized);
    void sendDesktopSync({ reason: "list-change", scope: "whitelist", operation: "add", domain: normalized });
    return id;
  },
  removeWhitelist: async (id: number): Promise<null> => {
    const list = await storageGet("whitelist");
    const entry = list.find((item) => item.id === id);
    await storageSet("whitelist", list.filter((item) => item.id !== id));
    if (entry) {
      await recordRemoval("whitelist", entry.domain);
      void sendDesktopSync({ reason: "list-change", scope: "whitelist", operation: "remove", domain: entry.domain });
    }
    return null;
  },

  listTemporaryAllows: async (): Promise<TemporaryAllowEntry[]> => {
    const now = Date.now();
    const active = (await storageGet("temporary_allowlist")).filter((entry) => entry.expires_at > now);
    await storageSet("temporary_allowlist", active);
    return active;
  },
  addTemporaryAllow: async (domain: string, durationMinutes: number): Promise<TemporaryAllowEntry> => {
    const normalized = normalizeDomain(domain);
    if (!normalized || !Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error("Enter a valid site and duration.");
    const entry = { id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, domain: normalized, expires_at: Date.now() + durationMinutes * 60_000 };
    await storageSet("temporary_allowlist", [...await ipc.listTemporaryAllows(), entry]);
    return entry;
  },
  removeTemporaryAllow: async (id: string): Promise<null> => {
    await storageSet("temporary_allowlist", (await storageGet("temporary_allowlist")).filter((entry) => entry.id !== id));
    return null;
  },

  listPresets: async (): Promise<Preset[]> => storageGet("presets"),
  createPreset: async (name: string, mode: SessionMode, durationMinutes: number, blocklist: string[], whitelist: string[]): Promise<null> => {
    const normalizedName = name.trim();
    if (!normalizedName || durationMinutes <= 0) throw new Error("Enter a preset name and duration.");
    const presets = await storageGet("presets");
    await storageSet("presets", [...presets, { id: `preset-${Date.now()}`, name: normalizedName, mode, duration_minutes: durationMinutes, blocklist, whitelist }]);
    return null;
  },
  deletePreset: async (id: string): Promise<null> => {
    await storageSet("presets", (await storageGet("presets")).filter((preset) => preset.id !== id));
    return null;
  },

  getSchedules: async (): Promise<Schedule[]> => storageGet("schedules"),
  createSchedule: async (startTime: string, endTime: string, mode: SessionMode, daysOfWeek = ALL_DAYS, endsOn: string | null = null): Promise<Schedule> => {
    const schedules = await storageGet("schedules");
    const valid = validateSchedule(startTime, endTime, daysOfWeek, endsOn, schedules);
    const schedule = { id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, start_time: startTime, end_time: endTime, mode, days_of_week: valid.days, ends_on: valid.endsOn };
    await storageSet("schedules", [...schedules, schedule]);
    return schedule;
  },
  updateSchedule: async (id: string, startTime: string, endTime: string, mode: SessionMode, daysOfWeek: number[], endsOn: string | null): Promise<Schedule> => {
    const schedules = await storageGet("schedules");
    if (!schedules.some((schedule) => schedule.id === id)) throw new Error("Schedule no longer exists.");
    const valid = validateSchedule(startTime, endTime, daysOfWeek, endsOn, schedules, id);
    const updated = { id, start_time: startTime, end_time: endTime, mode, days_of_week: valid.days, ends_on: valid.endsOn };
    await storageSet("schedules", schedules.map((schedule) => schedule.id === id ? updated : schedule));
    return updated;
  },
  deleteSchedule: async (id: string): Promise<null> => {
    await storageSet("schedules", (await storageGet("schedules")).filter((schedule) => schedule.id !== id));
    return null;
  },

  startChallenge: async (type: string): Promise<null> => { await storageSet("active_challenge", { type, status: "pending" }); return null; },
  cancelChallenge: async (): Promise<null> => { await storageSet("active_challenge", null); return null; },
  startSession: async (mode: SessionMode, durationMinutes: number, presetId?: string): Promise<null> => {
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error("Choose a valid duration.");
    const active = await storageGet("active_session");
    if (active?.status === "active") throw new Error("A browser session is already active.");
    const session: Session = {
      id: `browser-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      preset_id: presetId ?? null,
      mode,
      started_at: new Date().toISOString(),
      ended_at: null,
      planned_duration_sec: Math.floor(durationMinutes * 60),
      status: "active",
      blocklist_snapshot: (await storageGet("blocklist")).map((entry) => entry.domain),
      whitelist_snapshot: (await storageGet("whitelist")).map((entry) => entry.domain),
    };
    await storageSet("active_session", session);
    return null;
  },
  stopSession: async (): Promise<null> => {
    const active = await storageGet("active_session");
    if (!active) {
      if (await storageGet("desktop_session")) throw new Error("This session started in FocusBlock desktop. End it there.");
      return null;
    }
    if (active.scheduled_schedule_id) {
      const schedule = (await storageGet("schedules")).find((item) => item.id === active.scheduled_schedule_id);
      const endMinutes = schedule ? parseTime(schedule.end_time) : null;
      const end = new Date();
      if (endMinutes !== null) end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
      await storageSet("schedule_suppressed_until", end.getTime() > Date.now() ? end.getTime() : Date.now() + active.planned_duration_sec * 1000);
    }
    await archive(active, "stopped");
    await storageSet("active_session", null);
    await storageSet("active_challenge", null);
    return null;
  },

  listHistory: async (limit = 50): Promise<Session[]> => (await storageGet("history")).slice(0, limit),
  clearHistory: async (): Promise<null> => { await storageSet("history", []); return null; },
  getSettings: async (): Promise<AppSettings> => storageGet("settings"),
  updateSettings: async (settings: AppSettings): Promise<null> => { await storageSet("settings", settings); return null; },
  consumeDesktopSyncNotice: async (): Promise<string | null> => {
    const notice = await storageGet("desktop_sync_notice");
    if (notice) await storageSet("desktop_sync_notice", null);
    return notice;
  },
};
